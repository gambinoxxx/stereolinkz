"use server";

// The ONLY unauthenticated writes in the app (Invariant 14). Every action
// runs through publicAction: generic errors, nothing personal in the logs.
// Customers reach an existing deal only with its tracking token.
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { marketQuote } from "@/features/crypto-deposits/market-quote";
import { runEthCheck } from "@/features/crypto-deposits/eth-check";
import { nameCheck } from "@/features/crypto-deposits/names";
import type { EthCheck } from "@/features/crypto-deposits/providers/eth";
import { usdPrice } from "@/features/crypto-deposits/prices";
import { getCryptoDesk } from "@/features/crypto-deposits/public-queries";
import { submitCryptoDealInput } from "@/features/crypto-deposits/schema";
import {
  DEALABLE_TOKENS,
  officialToken,
} from "@/features/crypto-deposits/tokens";
import {
  checkDeposits,
  type ClaimResult,
} from "@/features/crypto-deposits/watch";
import { findDealIdByToken } from "@/features/deals/access";
import {
  notifyCustomerPaid,
  notifyDepositComplete,
  notifyNewDeal,
} from "@/features/deals/notify";
import {
  createDeal,
  CryptoAmountBusyError,
  DealRateLimitError,
  WEBSITE_LIMITS,
} from "@/features/deals/create";
import {
  getDealDeskContext,
  quoteBoardsOf,
} from "@/features/deals/public-queries";
import { quoteDeal } from "@/features/deals/quote";
import { submitDealInput } from "@/features/deals/schema";
import {
  checkFormToken,
  createTrackingToken,
  hashIp,
  issueFormToken,
} from "@/features/deals/security";
import type { ActionResult } from "@/lib/server/action";
import {
  checkUploadedDealFile,
  deleteDealFile,
  isDealFilePath,
  isDealFileType,
  issueDealUpload,
  MAX_DEAL_FILE_BYTES,
  MAX_FILES_PER_DEAL,
} from "@/lib/server/deal-files";
import { db } from "@/lib/server/db";
import { compareDecimalStrings } from "@/lib/decimal";
import { checkCode } from "@/features/referrals/attach";
import { REF_COOKIE } from "@/features/referrals/rules";
import type { NewDeal } from "@/features/deals/create";

const CHECK = "Please check the highlighted fields.";
const TOO_MANY =
  "Too many requests. Try again later or message us on WhatsApp.";
const GENERIC = "Something went wrong. Try again or message us on WhatsApp.";
const EXPIRED = "This form has expired. Reload the page and try again.";
const NOT_FOUND = "We couldn’t find that deal. Open your deal link again.";

// Like safeAction, without a member: any unexpected error becomes the
// generic message. Only the error's type is logged (no form contents).
function publicAction<Args extends unknown[], T>(
  name: string,
  fn: (...args: Args) => Promise<ActionResult<T>>,
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      unstable_rethrow(error);
      const kind = error instanceof Error ? error.name : typeof error;
      const code = (error as { code?: string })?.code;
      console.error(`[${name}] failed: ${kind}${code ? ` (${code})` : ""}`);
      return { ok: false, error: GENERIC };
    }
  };
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || null;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues)
    out[issue.path.map(String).join(".")] ??= issue.message;
  return out;
}

// ── Opening a form ────────────────────────────────────────────────────
// The deal forms are cached pages, so nothing per visitor is in their HTML:
// the signed timestamp for the bot check is fetched when the form opens.
// No database, no input.
export const startDealForm = publicAction(
  "startDealForm",
  async (): Promise<ActionResult<{ formToken: string }>> => ({
    ok: true,
    data: { formToken: issueFormToken() },
  }),
);

// Live dollar prices of the market-priced coins (BTC) for the sell form's
// estimate, fetched in the browser and refreshed while it's open. From the
// price feed's 30 s cache; null when there's no price (the form says so).
// The server quotes again at submit, whatever the form showed.
const MARKET_TICKERS = [
  ...new Set(
    DEALABLE_TOKENS.filter((t) => t.pricing === "MARKET").map((t) => t.ticker),
  ),
];
export const getMarketPrices = publicAction(
  "getMarketPrices",
  async (): Promise<ActionResult<Record<string, string | null>>> => {
    const prices = await Promise.all(
      MARKET_TICKERS.map(async (t) => [t, await usdPrice(t)] as const),
    );
    return { ok: true, data: Object.fromEntries(prices) };
  },
);

// ── Referral codes ────────────────────────────────────────────────────
// The form's optional code (prefilled from the /r/ or ?ref= cookie). An
// unknown or inactive TYPED code is a field error, and the customer can
// clear it and submit. The other rules (campaign, own number, new
// customer, service) run when the deal is created, silently: the deal
// never fails on them, and only the team sees why a code didn't apply.
async function referralFor(
  organizationId: string,
  raw: string | undefined,
): Promise<
  | { ok: true; referral: NewDeal["referral"] }
  | { ok: false; result: ActionResult<never> }
> {
  const check = await checkCode(organizationId, raw);
  if (!check.ok)
    return {
      ok: false,
      result: {
        ok: false,
        error: check.error,
        fieldErrors: { referralCode: check.error },
      },
    };
  return {
    ok: true,
    referral: check.code ? { code: check.code } : undefined,
  };
}

// Once a deal exists, the ?ref= cookie has done its job.
async function clearReferralCookie() {
  (await cookies()).delete(REF_COOKIE);
}

// ── Submit ────────────────────────────────────────────────────────────

export const submitDeal = publicAction(
  "submitDeal",
  async (
    raw: unknown,
  ): Promise<ActionResult<{ ref: string; token: string }>> => {
    const parsed = submitDealInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const input = parsed.data;

    // Bot checks: the hidden field is empty, and the form took 3 s or more.
    if (input.website.trim() !== "") return { ok: false, error: GENERIC };
    const form = checkFormToken(input.formToken);
    if (form === "expired") return { ok: false, error: EXPIRED };
    if (form !== "ok") return { ok: false, error: GENERIC };

    const ctx = await getDealDeskContext();
    const service = input.details.service;
    if (!ctx || !ctx.org.servicesEnabled.includes(service))
      return {
        ok: false,
        error:
          "This service isn’t available online right now. Message us on WhatsApp.",
      };

    // The server's own estimate, from the latest board (never the client's).
    const details =
      input.details.service === "SCHOOL_FEES"
        ? { ...input.details, invoiceRequired: true }
        : input.details;
    const quote = quoteDeal(
      { service, currency: input.currency, amount: input.amount, details },
      quoteBoardsOf(ctx),
    );
    const storedDetails =
      details.service === "POF" && quote?.bankName
        ? { ...details, bankName: quote.bankName }
        : details;

    const ref = await referralFor(ctx.org.id, input.referralCode);
    if (!ref.ok) return ref.result;

    const ip = await clientIp();
    const { token, hash } = createTrackingToken();
    try {
      const deal = await createDeal({
        organizationId: ctx.org.id,
        service,
        customer: input.customer,
        details: storedDetails,
        currency: input.currency,
        amount: input.amount,
        quote,
        payout:
          service === "FOREX_SELL" && input.payout
            ? { ...input.payout, accountName: input.customer.name }
            : undefined,
        ownerMembershipId: ctx.org.defaultOwnerId,
        trackingTokenHash: hash,
        ipHash: ip ? hashIp(ip) : null,
        actor: { type: "CUSTOMER" },
        message: "Requested on the website",
        limits: WEBSITE_LIMITS,
        referral: ref.referral,
      });
      await clearReferralCookie();
      // Emails go after the response; they never hold up or fail the deal.
      after(() => notifyNewDeal(deal.id, token));
      return { ok: true, data: { ref: deal.ref, token } };
    } catch (error) {
      if (error instanceof DealRateLimitError)
        return { ok: false, error: TOO_MANY };
      throw error;
    }
  },
);

// ── Sell crypto (deal-crypto.html) ────────────────────────────────────
// Same bot checks and limits as submitDeal. The deal starts at
// AWAITING_DEPOSIT with a copy of our wallet's address, the exact amount
// to send (unique on that wallet) and the rate lock; the customer goes
// straight to the deposit page.

export const submitCryptoDeal = publicAction(
  "submitCryptoDeal",
  async (
    raw: unknown,
  ): Promise<ActionResult<{ ref: string; token: string }>> => {
    const parsed = submitCryptoDealInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    const input = parsed.data;
    if (input.website.trim() !== "") return { ok: false, error: GENERIC };
    const form = checkFormToken(input.formToken);
    if (form === "expired") return { ok: false, error: EXPIRED };
    if (form !== "ok") return { ok: false, error: GENERIC };

    const unavailable = {
      ok: false as const,
      error:
        "Selling this coin online isn’t available right now. Message us on WhatsApp.",
    };
    const ctx = await getDealDeskContext();
    if (!ctx || !ctx.org.servicesEnabled.includes("CRYPTO_SELL"))
      return unavailable;
    const desk = await getCryptoDesk(ctx.org.id);
    const coin = desk?.coins.find((c) => c.ticker === input.ticker);
    const token = officialToken(input.network, input.ticker);
    if (
      !desk ||
      !coin ||
      !token ||
      !coin.networks.some((n) => n.network === input.network)
    )
      return unavailable;
    const wallet = await db.cryptoWallet.findFirst({
      where: {
        organizationId: ctx.org.id,
        ticker: input.ticker,
        network: input.network,
        active: true,
      },
      select: { id: true, address: true },
    });
    if (!wallet) return unavailable;

    // Stablecoins: qty is coins (1:1 with dollars). BTC: whole dollars.
    const market = token.pricing === "MARKET";
    const unit = market ? "" : ` ${input.ticker}`;
    const money = (v: string) => (market ? `$${v}` : v);
    if (market && !/^\d+$/.test(input.qty))
      return {
        ok: false,
        error: CHECK,
        fieldErrors: { qty: "Enter whole dollars, like 400." },
      };
    if (compareDecimalStrings(input.qty, desk.minQty) < 0)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: { qty: `The minimum is ${money(desk.minQty)}${unit}.` },
      };
    if (compareDecimalStrings(input.qty, desk.maxUsd) > 0)
      return {
        ok: false,
        error: CHECK,
        fieldErrors: {
          qty: `For more than ${money(desk.maxUsd)}${unit}, message us on WhatsApp.`,
        },
      };
    // BTC: quoted again here at a fresh price (never the page's).
    let marketTerms: {
      coins: string;
      quote: {
        quoteUsd: string;
        feeUsd: string;
        payoutUsd: string;
        priceUsd: string;
      };
    } | null = null;
    if (market) {
      const priceUsd = await usdPrice(input.ticker);
      const q =
        priceUsd &&
        marketQuote({
          usd: input.qty,
          priceUsd,
          marginPct: desk.marginPct,
          minFeeUsd: desk.minFeeUsd,
          rate: coin.rate,
          decimals: token.decimals,
        });
      if (!priceUsd || !q)
        return {
          ok: false,
          error:
            "We can’t get a live price right now. Try again in a minute or message us on WhatsApp.",
        };
      marketTerms = {
        coins: q.coins,
        quote: {
          quoteUsd: q.quoteUsd,
          feeUsd: q.feeUsd,
          payoutUsd: q.payoutUsd,
          priceUsd,
        },
      };
    }

    const ref = await referralFor(ctx.org.id, input.referralCode);
    if (!ref.ok) return ref.result;

    const ip = await clientIp();
    const tracking = createTrackingToken();
    try {
      const deal = await createDeal({
        organizationId: ctx.org.id,
        service: "CRYPTO_SELL",
        customer: input.customer,
        details: {
          service: "CRYPTO_SELL",
          ticker: input.ticker,
          network: input.network,
          payoutNameCheck: nameCheck(
            input.customer.name,
            input.payout.accountName,
          ),
        },
        currency: input.ticker,
        amount: marketTerms ? marketTerms.coins : input.qty,
        quote: null,
        payout: input.payout,
        ownerMembershipId: ctx.org.defaultOwnerId,
        trackingTokenHash: tracking.hash,
        ipHash: ip ? hashIp(ip) : null,
        actor: { type: "CUSTOMER" },
        message: "Requested on the website",
        limits: WEBSITE_LIMITS,
        crypto: {
          walletId: wallet.id,
          ticker: input.ticker,
          network: input.network,
          depositAddress: wallet.address,
          rate: coin.rate,
          boardId: desk.boardId,
          timeLabel: desk.timeLabel,
          lockMinutes: desk.lockMinutes,
          market: marketTerms?.quote,
        },
        referral: ref.referral,
      });
      await clearReferralCookie();
      after(() => notifyNewDeal(deal.id, tracking.token));
      return { ok: true, data: { ref: deal.ref, token: tracking.token } };
    } catch (error) {
      if (error instanceof DealRateLimitError)
        return { ok: false, error: TOO_MANY };
      if (error instanceof CryptoAmountBusyError)
        return {
          ok: false,
          error:
            "We have many deals for this amount right now. Change the amount slightly, or try again in a few minutes.",
        };
      throw error;
    }
  },
);

// ── Uploads (invoice at submit, receipt from the tracking page) ──────

const uploadRequest = z.object({
  ref: z.string().max(20),
  token: z.string().max(60),
  kind: z.enum(["INVOICE", "RECEIPT"]),
  contentType: z.string().max(60),
  size: z.number().int().positive(),
});

export const requestDealUpload = publicAction(
  "requestDealUpload",
  async (
    raw: unknown,
  ): Promise<ActionResult<{ pathname: string; clientToken: string }>> => {
    const parsed = uploadRequest.safeParse(raw);
    if (!parsed.success) return { ok: false, error: GENERIC };
    const { ref, token, contentType, size } = parsed.data;
    if (!isDealFileType(contentType))
      return { ok: false, error: "Upload a PDF, JPG or PNG." };
    if (size > MAX_DEAL_FILE_BYTES)
      return { ok: false, error: "That file is over 10 MB." };

    const ctx = await getDealDeskContext();
    const dealId = ctx && (await findDealIdByToken(ctx.org.id, ref, token));
    if (!ctx || !dealId) return { ok: false, error: NOT_FOUND };
    const count = await db.dealFile.count({ where: { dealId } });
    if (count >= MAX_FILES_PER_DEAL)
      return {
        ok: false,
        error: "This deal already has 3 files. Send anything else on WhatsApp.",
      };

    return {
      ok: true,
      data: await issueDealUpload(ctx.org.id, dealId, contentType),
    };
  },
);

const attachRequest = z.object({
  ref: z.string().max(20),
  token: z.string().max(60),
  kind: z.enum(["INVOICE", "RECEIPT"]),
  pathname: z.string().max(200),
  originalName: z.string().trim().min(1).max(120),
});

export const attachDealFile = publicAction(
  "attachDealFile",
  async (raw: unknown): Promise<ActionResult<{ id: string }>> => {
    const parsed = attachRequest.safeParse(raw);
    if (!parsed.success) return { ok: false, error: GENERIC };
    const { ref, token, kind, pathname, originalName } = parsed.data;

    const ctx = await getDealDeskContext();
    const dealId = ctx && (await findDealIdByToken(ctx.org.id, ref, token));
    if (!ctx || !dealId || !isDealFilePath(pathname, ctx.org.id, dealId))
      return { ok: false, error: NOT_FOUND };

    const file = await checkUploadedDealFile(pathname);
    if (!file)
      return {
        ok: false,
        error:
          "That file couldn’t be read. Upload a PDF, JPG or PNG up to 10 MB.",
      };

    // Record it with its event; the 3-file limit is checked again here.
    const created = await db.$transaction(async (tx) => {
      const count = await tx.dealFile.count({ where: { dealId } });
      if (count >= MAX_FILES_PER_DEAL) return null;
      const row = await tx.dealFile.create({
        data: {
          dealId,
          kind,
          blobUrl: file.url,
          blobPathname: file.pathname,
          contentType: file.contentType,
          byteSize: file.byteSize,
          originalName,
          uploadedBy: "CUSTOMER",
        },
        select: { id: true },
      });
      await tx.dealEvent.create({
        data: {
          dealId,
          type: "FILE_UPLOADED",
          message: kind === "INVOICE" ? "Invoice uploaded" : "Receipt uploaded",
          data: { fileId: row.id, kind, byteSize: file.byteSize },
          actorType: "CUSTOMER",
        },
      });
      return row;
    });
    if (!created) {
      await deleteDealFile(file.url);
      return {
        ok: false,
        error: "This deal already has 3 files. Send anything else on WhatsApp.",
      };
    }
    return { ok: true, data: { id: created.id } };
  },
);

// ── "I’ve paid" (tracking page) ───────────────────────────────────────
// A customer event only: the status never moves here. A team member marks
// the payment received after checking the bank statement (Invariant 15).

const paidRequest = z.object({
  ref: z.string().max(20),
  token: z.string().max(60),
});

export const markDealPaid = publicAction(
  "markDealPaid",
  async (raw: unknown): Promise<ActionResult<{ recorded: boolean }>> => {
    const parsed = paidRequest.safeParse(raw);
    if (!parsed.success) return { ok: false, error: GENERIC };
    const ctx = await getDealDeskContext();
    const dealId =
      ctx &&
      (await findDealIdByToken(ctx.org.id, parsed.data.ref, parsed.data.token));
    if (!dealId) return { ok: false, error: NOT_FOUND };

    const deal = await db.deal.findUniqueOrThrow({
      where: { id: dealId },
      select: { status: true },
    });
    if (deal.status !== "AWAITING_PAYMENT")
      return {
        ok: false,
        error:
          "This deal isn’t waiting for a payment. Message us on WhatsApp if you need help.",
      };

    // Once per deal: AWAITING_PAYMENT is reached only once (the state
    // machine never goes back), so a second tap changes nothing.
    const already = await db.dealEvent.findFirst({
      where: { dealId, type: "CUSTOMER_PAID" },
      select: { id: true },
    });
    if (already) return { ok: true, data: { recorded: false } };

    await db.dealEvent.create({
      data: {
        dealId,
        type: "CUSTOMER_PAID",
        message: "Customer says they’ve paid",
        actorType: "CUSTOMER",
      },
    });
    after(() => notifyCustomerPaid(dealId));
    return { ok: true, data: { recorded: true } };
  },
);

// ── "Check my deposit" (crypto deposit page) ──────────────────────────
// Runs the deposit check for this deal's wallet now, at most once per
// 10 s per deal (the page polls every 15 s). A pasted TxID is only used
// to look up a transfer we have already seen at our address: it is never
// stored or logged on its own (a 64-hex TxID looks like a private key).

const CHECK_EVERY_MS = 10_000;

const depositCheckRequest = z.object({
  ref: z.string().max(20),
  token: z.string().max(60),
  txHash: z
    .string()
    .trim()
    .transform((v) => v.replace(/^0x/i, "").toLowerCase())
    .pipe(z.union([z.literal(""), z.string().regex(/^[0-9a-f]{64}$/)]))
    .optional(),
});

export type DepositCheckResult = {
  checked: boolean; // false: checked less than 10 s ago, try again shortly
  claim: ClaimResult | null;
};

export const checkMyDeposit = publicAction(
  "checkMyDeposit",
  async (raw: unknown): Promise<ActionResult<DepositCheckResult>> => {
    const parsed = depositCheckRequest.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error:
          "That doesn’t look like a TxID. Copy it from your wallet’s transaction details.",
      };
    const { ref, token, txHash } = parsed.data;
    const ctx = await getDealDeskContext();
    const dealId = ctx && (await findDealIdByToken(ctx.org.id, ref, token));
    if (!dealId) return { ok: false, error: NOT_FOUND };

    const now = new Date();
    const { count } = await db.deal.updateMany({
      where: {
        id: dealId,
        service: "CRYPTO_SELL",
        status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_SEEN", "EXPIRED"] },
        walletId: { not: null },
        OR: [
          { lastDepositCheckAt: null },
          {
            lastDepositCheckAt: {
              lt: new Date(now.getTime() - CHECK_EVERY_MS),
            },
          },
        ],
      },
      data: { lastDepositCheckAt: now },
    });
    if (count === 0) return { ok: true, data: { checked: false, claim: null } };

    const { walletId } = await db.deal.findUniqueOrThrow({
      where: { id: dealId },
      select: { walletId: true },
    });
    const summary = await checkDeposits(walletId!, {
      now,
      claim: txHash ? { dealId, txHash } : undefined,
    });
    for (const id of summary.completed) after(() => notifyDepositComplete(id));
    return { ok: true, data: { checked: true, claim: summary.claim } };
  },
);

// ── ETH transfer checker (public, read-only; Phase 13b) ──────────────
// ETH is arranged on WhatsApp; this only reports a transfer's status to
// our ETH address. Limited per IP (best effort, per server instance) and
// cached per TxID, so it can't be used to burn the Etherscan quota.

const ETH_CHECKS_PER_MINUTE = 6;
const ethChecks = new Map<string, number[]>();

export const checkEthTransfer = publicAction(
  "checkEthTransfer",
  async (raw: unknown): Promise<ActionResult<EthCheck>> => {
    const ctx = await getDealDeskContext();
    if (!ctx) return { ok: false, error: GENERIC };
    const ip = await clientIp();
    const key = ip ? hashIp(ip) : "unknown";
    const now = Date.now();
    const recent = (ethChecks.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= ETH_CHECKS_PER_MINUTE)
      return {
        ok: false,
        error: "Too many checks. Wait a minute and try again.",
      };
    ethChecks.set(key, [...recent, now]);
    if (ethChecks.size > 5000) ethChecks.delete(ethChecks.keys().next().value!);
    return runEthCheck(ctx.org.id, raw);
  },
);
