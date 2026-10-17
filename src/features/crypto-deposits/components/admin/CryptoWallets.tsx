"use client";

import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCryptoWallet,
  deactivateCryptoWallet,
} from "@/features/crypto-deposits/wallet-actions";
import { NETWORKS, OFFICIAL_TOKENS } from "@/features/crypto-deposits/tokens";
import type { CryptoNetwork } from "@/generated/prisma/enums";
import {
  FieldError,
  Select,
} from "@/features/settings/components/settings-parts";

export type WalletRow = {
  id: string;
  ticker: string;
  network: CryptoNetwork;
  address: string;
  minConfirmations: number;
  active: boolean;
  watching: { tone: "ok" | "warn" | "idle"; text: string };
};

const ends = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

// settings-deal-desk.html → Crypto wallets. Inside the settings form, so
// Enter here must not submit it; these controls save on their own.
export function CryptoWallets({ wallets }: { wallets: WalletRow[] }) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const first = OFFICIAL_TOKENS[0]!;
  const [v, setV] = useState({
    key: `${first.network}:${first.ticker}`,
    address: "",
    minConfirmations: String(NETWORKS[first.network].defaultConfirmations),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const token =
    OFFICIAL_TOKENS.find((t) => `${t.network}:${t.ticker}` === v.key) ?? first;
  const active = wallets.filter((w) => w.active);
  const stopEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const add = () =>
    start(async () => {
      const result = await addCryptoWallet({
        ticker: token.ticker,
        network: token.network,
        address: v.address,
        minConfirmations: v.minConfirmations,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setAdding(false);
      setV((s) => ({ ...s, address: "" }));
      toast.success("Wallet added. The app starts watching it.");
      router.refresh();
    });

  const deactivate = (w: WalletRow) =>
    start(async () => {
      if (
        !window.confirm(
          `Stop offering ${w.ticker} on ${w.network} at ${ends(w.address)}? Open deals on it are still watched.`,
        )
      )
        return;
      const result = await deactivateCryptoWallet(w.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Wallet deactivated");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3" onKeyDown={stopEnter}>
      {active.length === 0 ? (
        <p className="text-[14px] text-text-secondary">
          No wallets yet. Add the receiving address customers send to.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {active.map((w) => (
            <li
              key={w.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
            >
              <span
                aria-hidden="true"
                className="grid size-[34px] place-items-center rounded-full bg-bank-mark-4 font-extrabold text-white"
              >
                {w.ticker[0]}
              </span>
              <div className="min-w-0">
                <b className="block">
                  {w.ticker} · {w.network}
                </b>
                <code className="block text-[12.5px] break-all text-text-secondary">
                  {w.address}
                </code>
                <span className="text-[12.5px] text-text-muted">
                  {w.minConfirmations} confirmations · official contract{" "}
                  {
                    OFFICIAL_TOKENS.find(
                      (t) => t.network === w.network && t.ticker === w.ticker,
                    )?.contract
                  }
                </span>
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <Badge
                  variant={
                    w.watching.tone === "ok"
                      ? "success"
                      : w.watching.tone === "warn"
                        ? "gold"
                        : "default"
                  }
                >
                  {w.watching.text}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-start-2 justify-self-start sm:col-start-auto"
                disabled={busy}
                onClick={() => deactivate(w)}
              >
                Deactivate
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="grid gap-3.5 rounded-[12px] border border-border-default p-4">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-coin`}>Coin and network</Label>
              <Select
                id={`${id}-coin`}
                value={v.key}
                onChange={(e) => {
                  const t = OFFICIAL_TOKENS.find(
                    (o) => `${o.network}:${o.ticker}` === e.target.value,
                  )!;
                  setV((s) => ({
                    ...s,
                    key: e.target.value,
                    minConfirmations: String(
                      NETWORKS[t.network].defaultConfirmations,
                    ),
                  }));
                }}
              >
                {OFFICIAL_TOKENS.map((t) => (
                  <option
                    key={`${t.network}:${t.ticker}`}
                    value={`${t.network}:${t.ticker}`}
                  >
                    {t.ticker} · {NETWORKS[t.network].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-conf`}>Confirmations needed</Label>
              <Input
                id={`${id}-conf`}
                inputMode="numeric"
                value={v.minConfirmations}
                onChange={(e) =>
                  setV((s) => ({ ...s, minConfirmations: e.target.value }))
                }
                aria-invalid={errors.minConfirmations ? true : undefined}
              />
              <FieldError
                id={`${id}-conf-error`}
                message={errors.minConfirmations}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-addr`}>Receiving address</Label>
            <Input
              id={`${id}-addr`}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={
                token.network === "TRC20" ? "T… (34 characters)" : "0x…"
              }
              value={v.address}
              onChange={(e) => setV((s) => ({ ...s, address: e.target.value }))}
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={`${id}-addr-hint`}
            />
            <FieldError id={`${id}-addr-error`} message={errors.address} />
            <span
              id={`${id}-addr-hint`}
              className="text-[12.5px] text-text-muted"
            >
              Copy it from your wallet’s Receive screen, then check it character
              by character on the explorer.
            </span>
          </div>
          <div className="text-[13px] text-text-secondary">
            Official {token.ticker} contract on {NETWORKS[token.network].chain}{" "}
            (fixed, read-only):{" "}
            <code className="break-all">{token.contract}</code> ·{" "}
            {token.decimals} decimals
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              disabled={busy || !v.address.trim()}
              onClick={add}
            >
              {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
              Add wallet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setErrors({});
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus strokeWidth={1.9} />
            Add wallet
          </Button>
        </div>
      )}
      <p className="flex gap-2 text-[13px] text-state-error">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          strokeWidth={1.9}
        />
        Never enter a private key or recovery phrase here. The app only needs
        the receiving address, and refuses anything that looks like a key.
      </p>
    </div>
  );
}
