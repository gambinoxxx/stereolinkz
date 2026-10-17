"use server";

// Settings → Deal desk → Crypto wallets (Invariant 16). Our receiving
// addresses only, watched read-only: the address is checked for its
// network's format and refused if it looks like a key or recovery phrase.
// Wallets are never edited or deleted (a deal keeps the address it
// showed); a new address is a new wallet, an old one is deactivated.
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkWalletAddress } from "@/features/crypto-deposits/address";
import { officialToken } from "@/features/crypto-deposits/tokens";
import { Prisma } from "@/generated/prisma/client";
import { type ActionResult, safeAction } from "@/lib/server/action";
import { db } from "@/lib/server/db";

function revalidateWallets() {
  for (const path of [
    "/admin/settings/deal-desk",
    "/deal/new",
    "/deal/new/crypto",
  ])
    revalidatePath(path);
}

const walletInput = z.object({
  ticker: z.string().regex(/^[A-Z0-9]{2,6}$/),
  network: z.enum(["TRC20", "BEP20"]),
  address: z.string().max(200),
  minConfirmations: z.coerce
    .number({ error: "Enter a number, like 19." })
    .int("Whole numbers only.")
    .min(1, "At least 1.")
    .max(200, "At most 200."),
});

export const addCryptoWallet = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = walletInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues)
        fieldErrors[String(i.path[0])] ??= i.message;
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors,
      };
    }
    const { ticker, network, minConfirmations } = parsed.data;
    if (!officialToken(network, ticker))
      return {
        ok: false,
        error: `${ticker} on ${network} isn’t supported.`,
        fieldErrors: { network: "Not supported." },
      };
    // The key / phrase check runs before anything is stored or logged.
    const address = checkWalletAddress(network, parsed.data.address);
    if (!address.ok)
      return {
        ok: false,
        error: address.error,
        fieldErrors: { address: address.error },
      };
    try {
      const wallet = await db.cryptoWallet.create({
        data: {
          organizationId,
          ticker,
          network,
          address: address.address,
          minConfirmations,
          createdById: userId,
        },
        select: { id: true },
      });
      revalidateWallets();
      return { ok: true, data: { id: wallet.id } };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return {
          ok: false,
          error: `There’s already an active ${ticker} ${network} wallet. Deactivate it first.`,
        };
      throw error;
    }
  },
);

export const deactivateCryptoWallet = safeAction(
  async (
    { organizationId },
    walletId: unknown,
  ): Promise<ActionResult<{ id: string }>> => {
    if (typeof walletId !== "string")
      return {
        ok: false,
        error: "That wallet no longer exists. Reload the page.",
      };
    const { count } = await db.cryptoWallet.updateMany({
      where: { id: walletId, organizationId, active: true },
      data: { active: false, deactivatedAt: new Date() },
    });
    if (count !== 1)
      return {
        ok: false,
        error: "That wallet no longer exists. Reload the page.",
      };
    revalidateWallets();
    return { ok: true, data: { id: walletId } };
  },
);
