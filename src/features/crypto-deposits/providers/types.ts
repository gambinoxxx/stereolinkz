// The read-only blockchain data the deposit watcher needs, behind one
// interface so tests use recorded fixtures and never call a real API.
// A provider only READS: nothing here can sign or send (Invariant 16).
import type { CryptoNetwork } from "@/generated/prisma/client";

// A token transfer into one of our addresses, as the provider's index
// reports it. Amounts are exact decimal strings in coins.
export type IncomingTransfer = {
  network: CryptoNetwork;
  txHash: string;
  logIndex: number; // position among this transaction's transfers to us
  fromAddress: string;
  toAddress: string;
  tokenContract: string;
  amount: string;
  blockTime: Date;
};

// What the chain itself says about a transfer, read from the transaction
// receipt (not the index): the watcher confirms a deposit only when this
// agrees with the index on contract, recipient and amount.
export type TransferProof =
  | { state: "PENDING" } // not in a block yet
  | { state: "FAILED"; reason: string } // reverted, or the receipt disagrees
  | {
      state: "IN_BLOCK";
      blockNumber: bigint;
      confirmations: number;
    };

export interface DepositProvider {
  readonly network: CryptoNetwork;
  // Every token transfer to the address since the time, any token: wrong
  // tokens are recorded too, so a TxID that points at one is caught.
  listIncomingTransfers(
    address: string,
    since: Date,
  ): Promise<IncomingTransfer[]>;
  getProof(transfer: IncomingTransfer): Promise<TransferProof>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
