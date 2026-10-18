// Settings → Deal desk → Crypto wallets: what addCryptoWallet accepts,
// pure so it can be tested. Every network the database knows passes the
// schema, so a new one can't be missed here; whether a coin is offered on a
// network is officialToken()'s job, and the address format and the key /
// phrase refusal (run before anything is stored or logged) are
// checkWalletAddress()'s.
import { z } from "zod";

import { checkWalletAddress } from "@/features/crypto-deposits/address";
import { officialToken } from "@/features/crypto-deposits/tokens";
import { CryptoNetwork } from "@/generated/prisma/enums";

export const walletInput = z.object({
  ticker: z.string().regex(/^[A-Z0-9]{2,6}$/, "Pick a coin."),
  network: z.enum(CryptoNetwork, { error: "Pick a network." }),
  address: z.string().max(200),
  minConfirmations: z.coerce
    .number({ error: "Enter a number, like 19." })
    .int("Whole numbers only.")
    .min(1, "At least 1.")
    .max(200, "At most 200."),
});

export type WalletValues = {
  ticker: string;
  network: CryptoNetwork;
  address: string;
  minConfirmations: number;
};

export type WalletParse =
  | { ok: true; data: WalletValues }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

export function parseWalletInput(raw: unknown): WalletParse {
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
  const address = checkWalletAddress(network, parsed.data.address);
  if (!address.ok)
    return {
      ok: false,
      error: address.error,
      fieldErrors: { address: address.error },
    };
  return {
    ok: true,
    data: { ticker, network, address: address.address, minConfirmations },
  };
}
