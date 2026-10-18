import "server-only";

// The ETH transfer checker (Phase 13b), shared by the team's action and
// the customer's public page. Read-only: it looks up one transaction and
// compares it with our active ETH wallet. Results are cached for 15 s per
// TxID so repeated checks don't spend the Etherscan quota.
import { z } from "zod";

import {
  etherscan,
  type EthCheck,
} from "@/features/crypto-deposits/providers/eth";
import type { ActionResult } from "@/lib/server/action";
import { db } from "@/lib/server/db";

const input = z.object({
  txHash: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .pipe(
      z
        .string()
        .regex(
          /^0x[0-9a-f]{64}$/,
          "Paste the full transaction hash: 0x and 64 letters and digits.",
        ),
    ),
});

const cache = new Map<string, { at: number; result: EthCheck }>();
const TTL_MS = 15_000;

export async function runEthCheck(
  organizationId: string,
  raw: unknown,
): Promise<ActionResult<EthCheck>> {
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]!.message };
  const wallet = await db.cryptoWallet.findFirst({
    where: { organizationId, network: "ETH", active: true },
    select: { address: true },
  });
  if (!wallet)
    return {
      ok: false,
      error: "ETH checks aren’t set up yet. Message us on WhatsApp.",
    };
  const client = etherscan();
  if (!client.configured)
    return {
      ok: false,
      error: "ETH checks aren’t set up yet. Message us on WhatsApp.",
    };

  const key = `${organizationId}:${parsed.data.txHash}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS)
    return { ok: true, data: hit.result };
  try {
    const result = await client.checkTransfer(
      parsed.data.txHash,
      wallet.address,
    );
    cache.set(key, { at: Date.now(), result });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return { ok: true, data: result };
  } catch {
    return {
      ok: false,
      error: "We couldn’t reach Ethereum just now. Try again in a minute.",
    };
  }
}
