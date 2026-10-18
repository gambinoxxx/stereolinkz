"use server";

// Settings → Deal desk → Crypto wallets (Invariant 16). Our receiving
// addresses only, watched read-only: the address is checked for its
// network's format and refused if it looks like a key or recovery phrase.
// Wallets are never edited or deleted (a deal keeps the address it
// showed); a new address is a new wallet, an old one is deactivated.
import { revalidatePath } from "next/cache";

import { parseWalletInput } from "@/features/crypto-deposits/wallet-input";
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

export const addCryptoWallet = safeAction(
  async (
    { organizationId, userId },
    raw: unknown,
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = parseWalletInput(raw);
    if (!parsed.ok) return parsed;
    const { ticker, network, address, minConfirmations } = parsed.data;
    try {
      const wallet = await db.cryptoWallet.create({
        data: {
          organizationId,
          ticker,
          network,
          address,
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
