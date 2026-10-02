"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defaultBadgeColor } from "@/features/coins/badge-color";
import {
  coinDetailsInput,
  coinInput,
  cryptoRateInput,
  networksInput,
} from "@/features/coins/schema";
import { RATE_ERRORS } from "@/features/forex-rates/schema";
import { compareDecimalStrings, toDecimalString } from "@/lib/decimal";
import { isSameIdSet } from "@/lib/order";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { uploadImage, validateImage } from "@/lib/server/blob";
import { db } from "@/lib/server/db";
import { isCheckViolation, isPrismaError } from "@/lib/server/prisma-errors";

// Pages that show coins or crypto rates.
function revalidateCryptoPages() {
  for (const path of [
    "/admin/crypto",
    "/admin",
    "/admin/generator",
    "/admin/templates",
    "/admin/history",
  ])
    revalidatePath(path);
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues)
    fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

const NOT_FOUND = "This coin no longer exists. Refresh the page.";
const SELL_BELOW_BUY = {
  ok: false as const,
  error: RATE_ERRORS.sellBelowBuy,
  fieldErrors: { sell: RATE_ERRORS.sellBelowBuy },
};

type SavedCoin = {
  ticker: string;
  rateChanged: boolean;
  detailsChanged: boolean;
};

// The edit drawer: a new rate (insert-only, Invariant 2) and/or new
// networks, in one transaction. Unchanged values write nothing.
async function saveEdit(
  organizationId: string,
  userId: string,
  raw: { coinId: unknown; buy?: unknown; sell?: unknown; networks?: unknown },
): Promise<ActionResult<SavedCoin>> {
  const rate =
    raw.buy !== undefined
      ? cryptoRateInput.safeParse({
          coinId: raw.coinId,
          buy: raw.buy,
          sell: raw.sell,
        })
      : null;
  const details =
    raw.networks !== undefined
      ? coinDetailsInput.safeParse({
          coinId: raw.coinId,
          networks: raw.networks,
        })
      : null;
  if ((rate && !rate.success) || (details && !details.success))
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf([
        ...(rate?.error?.issues ?? []),
        ...(details?.error?.issues ?? []),
      ]),
    };
  if (typeof raw.coinId !== "string") return { ok: false, error: NOT_FOUND };

  // Scoped through the org, so a rate can only be added to our coin.
  const coin = await db.coin.findFirst({
    where: { id: raw.coinId, organizationId },
    select: {
      id: true,
      ticker: true,
      networks: true,
      rates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { buy: true, sell: true },
      },
    },
  });
  if (!coin) return { ok: false, error: NOT_FOUND };

  const current = coin.rates[0];
  const newRate =
    rate?.success &&
    !(
      current &&
      compareDecimalStrings(toDecimalString(current.buy), rate.data.buy) ===
        0 &&
      compareDecimalStrings(toDecimalString(current.sell), rate.data.sell) === 0
    )
      ? rate.data
      : null;
  const newNetworks =
    details?.success &&
    JSON.stringify(details.data.networks) !== JSON.stringify(coin.networks)
      ? details.data.networks
      : null;

  if (!newRate && !newNetworks)
    return {
      ok: true,
      data: { ticker: coin.ticker, rateChanged: false, detailsChanged: false },
    };

  try {
    await db.$transaction([
      ...(newRate
        ? [
            db.cryptoRate.create({
              data: {
                coinId: coin.id,
                buy: newRate.buy,
                sell: newRate.sell,
                createdById: userId,
              },
            }),
          ]
        : []),
      ...(newNetworks
        ? [
            db.coin.update({
              where: { id: coin.id, organizationId },
              data: { networks: newNetworks },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    // Safety net behind the Zod check: the DB CHECK (sell >= buy).
    if (isCheckViolation(error, "crypto_sell_gte_buy")) return SELL_BELOW_BUY;
    throw error;
  }

  revalidateCryptoPages();
  return {
    ok: true,
    data: {
      ticker: coin.ticker,
      rateChanged: newRate !== null,
      detailsChanged: newNetworks !== null,
    },
  };
}

const saveRate = safeAction(
  async ({ organizationId, userId }, raw: unknown) => {
    const input = (raw ?? {}) as {
      coinId?: unknown;
      buy?: unknown;
      sell?: unknown;
    };
    return saveEdit(organizationId, userId, {
      coinId: input.coinId,
      buy: input.buy ?? "",
      sell: input.sell ?? "",
    });
  },
);

const saveCoin = safeAction(
  async ({ organizationId, userId }, raw: unknown) => {
    const input = (raw ?? {}) as {
      coinId?: unknown;
      buy?: unknown;
      sell?: unknown;
      networks?: unknown;
    };
    return saveEdit(organizationId, userId, {
      coinId: input.coinId,
      buy: input.buy ?? "",
      sell: input.sell ?? "",
      networks: input.networks ?? [],
    });
  },
);

// Networks and the icon only; never the ticker, name or rates.
const updateDetails = safeAction(
  async (
    { organizationId },
    raw: unknown,
  ): Promise<ActionResult<{ ticker: string }>> => {
    const parsed = z
      .object({
        coinId: z.string().min(1),
        networks: networksInput.optional(),
        iconUrl: z.string().url().nullable().optional(),
      })
      .safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: fieldErrorsOf(parsed.error.issues),
      };
    const { coinId, networks, iconUrl } = parsed.data;
    try {
      const coin = await db.coin.update({
        where: { id: coinId, organizationId },
        data: {
          ...(networks !== undefined ? { networks } : {}),
          ...(iconUrl !== undefined ? { iconUrl } : {}),
        },
        select: { ticker: true },
      });
      revalidateCryptoPages();
      return { ok: true, data: coin };
    } catch (error) {
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

// A Coin and its first CryptoRate, together or not at all. The badge
// colour comes from the ticker; the icon (if any) was uploaded first.
const create = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<{ id: string; ticker: string }>> => {
    const parsed = coinInput.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: fieldErrorsOf(parsed.error.issues),
      };
    const input = parsed.data;

    try {
      const coin = await db.$transaction(async (tx) => {
        const { _max } = await tx.coin.aggregate({
          where: { organizationId },
          _max: { sortOrder: true },
        });
        const created = await tx.coin.create({
          data: {
            organizationId,
            ticker: input.ticker,
            name: input.name,
            networks: input.networks,
            iconUrl: input.iconUrl,
            badgeColor: defaultBadgeColor(input.ticker),
            status: input.active ? "ACTIVE" : "INACTIVE",
            sortOrder: (_max.sortOrder ?? -1) + 1, // new coins go last
          },
          select: { id: true, ticker: true },
        });
        await tx.cryptoRate.create({
          data: {
            coinId: created.id,
            buy: input.buy,
            sell: input.sell,
            createdById: userId,
          },
        });
        return created;
      });
      revalidateCryptoPages();
      return { ok: true, data: coin };
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const message = `${input.ticker} already exists. Edit it from the table instead.`;
        return { ok: false, error: message, fieldErrors: { ticker: message } };
      }
      if (isCheckViolation(error, "crypto_sell_gte_buy")) return SELL_BELOW_BUY;
      throw error;
    }
  },
);

// The bank-logo rules (PNG, SVG or JPEG, ≤ 1 MB, checked on the bytes),
// at a new path every time: coins/{org}/{uuid}.{ext}. Returns the URL for
// the add drawer or "Change icon"; old icons stay (Invariant 12).
const uploadIcon = safeAction(
  async (
    { organizationId },
    form: unknown,
  ): Promise<ActionResult<{ iconUrl: string }>> => {
    const file = form instanceof FormData ? form.get("icon") : null;
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "Choose an icon file." };
    const image = await validateImage(file);
    if (!image.ok)
      return {
        ok: false,
        error: image.error,
        fieldErrors: { icon: image.error },
      };
    const { url } = await uploadImage(
      image,
      `coins/${organizationId}/${crypto.randomUUID()}.${image.ext}`,
      { randomSuffix: false },
    );
    return { ok: true, data: { iconUrl: url } };
  },
);

const statusInput = z.enum(["ACTIVE", "INACTIVE"]);

// Status lives on the Coin (never on rate rows).
const setStatus = safeAction(
  async (
    { organizationId },
    id: unknown,
    status: unknown,
  ): Promise<
    ActionResult<{ ticker: string; status: "ACTIVE" | "INACTIVE" }>
  > => {
    const parsed = statusInput.safeParse(status);
    if (typeof id !== "string" || !parsed.success)
      return { ok: false, error: NOT_FOUND };
    try {
      const coin = await db.coin.update({
        where: { id, organizationId },
        data: { status: parsed.data },
        select: { ticker: true },
      });
      revalidateCryptoPages();
      return { ok: true, data: { ticker: coin.ticker, status: parsed.data } };
    } catch (error) {
      if (isPrismaError(error, "P2025")) return { ok: false, error: NOT_FOUND };
      throw error;
    }
  },
);

const STALE_ORDER = "The list changed. Refresh and try again.";

// Board order: sortOrder = position, for every non-archived coin at once,
// so a partial (filtered) list can never be saved.
const reorder = safeAction(
  async ({ organizationId }, raw: unknown): Promise<ActionResult<null>> => {
    const parsed = z.array(z.string().min(1)).max(500).safeParse(raw);
    if (!parsed.success) return { ok: false, error: STALE_ORDER };
    const ordered = parsed.data;

    const saved = await db.$transaction(async (tx) => {
      const existing = await tx.coin.findMany({
        where: { organizationId, status: { not: "ARCHIVED" } },
        select: { id: true },
      });
      if (
        !isSameIdSet(
          ordered,
          existing.map((c) => c.id),
        )
      )
        return false;
      for (const [index, id] of ordered.entries())
        await tx.coin.update({
          where: { id, organizationId },
          data: { sortOrder: index },
        });
      return true;
    });
    if (!saved) return { ok: false, error: STALE_ORDER };

    revalidateCryptoPages();
    return { ok: true, data: null };
  },
);

// A "use server" file may only export async functions.
export async function saveCryptoRate(input: {
  coinId: string;
  buy: string;
  sell: string;
}) {
  return saveRate(input);
}

export async function saveCoinEdit(input: {
  coinId: string;
  buy: string;
  sell: string;
  networks: string;
}) {
  return saveCoin(input);
}

export async function updateCoinDetails(input: {
  coinId: string;
  networks?: string;
  iconUrl?: string | null;
}) {
  return updateDetails(input);
}

export async function createCoin(input: unknown) {
  return create(input);
}

export async function uploadCoinIcon(form: FormData) {
  return uploadIcon(form);
}

export async function setCoinStatus(id: string, status: string) {
  return setStatus(id, status);
}

export async function reorderCoins(orderedIds: string[]) {
  return reorder(orderedIds);
}
