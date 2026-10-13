"use server";

// The ONLY unauthenticated writes in the app (Invariant 14). Every action
// runs through publicAction: generic errors, nothing personal in the logs.
// Customers reach an existing deal only with its tracking token.
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { findDealIdByToken } from "@/features/deals/access";
import {
  createDeal,
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
      });
      return { ok: true, data: { ref: deal.ref, token } };
    } catch (error) {
      if (error instanceof DealRateLimitError)
        return { ok: false, error: TOO_MANY };
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
    return { ok: true, data: { recorded: true } };
  },
);
