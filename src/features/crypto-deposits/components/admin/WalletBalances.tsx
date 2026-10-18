"use client";

import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getWalletBalances } from "@/features/crypto-deposits/actions";
import type { Balance } from "@/features/crypto-deposits/providers/balances";
import { formatRate } from "@/lib/format";

export type WalletCard = {
  id: string;
  ticker: string;
  network: string;
  networkLabel: string;
  address: string;
  explorerAddress: string;
};

const REFRESH_MS = 60_000;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
// "24847.874401" → "24,847.874401"
const amount = (v: string) => {
  const [int = "0", frac] = v.split(".");
  return `${formatRate(int)}${frac ? `.${frac}` : ""}`;
};

// Live balances of our watched wallets (read-only), refreshed every minute
// while the page is open.
export function WalletBalances({ wallets }: { wallets: WalletCard[] }) {
  const [rows, setRows] = useState<
    Record<string, { balance: Balance; checkedAt: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await getWalletBalances();
    setBusy(false);
    if (!r.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows(
      Object.fromEntries(
        r.data.map((x) => [
          x.walletId,
          { balance: x.balance, checkedAt: x.checkedAt },
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  if (wallets.length === 0)
    return (
      <p className="text-[14px] text-text-secondary">
        No active wallets. Add them in Settings → Deal desk.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3.5 sheet:grid-cols-2 wide:grid-cols-3">
        {wallets.map((w) => {
          const row = rows[w.id];
          return (
            <section
              key={w.id}
              className="rounded-panel border border-border-default bg-bg-surface px-[18px] py-4"
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-[15px]">
                  {w.ticker} · {w.networkLabel}
                </b>
                <a
                  href={w.explorerAddress}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-primary"
                >
                  Explorer{" "}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
              <code className="mt-0.5 block text-[12.5px] text-text-muted">
                {short(w.address)}
              </code>
              <div className="mt-3 min-h-[60px]" aria-live="polite">
                {!row ? (
                  <span className="text-[14px] text-text-muted">Loading…</span>
                ) : row.balance.ok ? (
                  row.balance.lines.map((l, i) => (
                    <div
                      key={l.label}
                      className={
                        i === 0
                          ? "text-[26px] leading-tight font-[750] tracking-[-0.5px] tabular-nums"
                          : "text-[13.5px] text-text-secondary tabular-nums"
                      }
                    >
                      {amount(l.amount)} {l.label}
                    </div>
                  ))
                ) : (
                  <span className="text-[14px] text-accent-gold-text">
                    {row.balance.error}
                  </span>
                )}
              </div>
              {row && (
                <div
                  className="mt-2 text-[12.5px] text-text-muted"
                  suppressHydrationWarning
                >
                  Checked {new Date(row.checkedAt).toLocaleTimeString()}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw strokeWidth={1.9} />
          )}
          Refresh now
        </Button>
        {failed && (
          <span className="text-[13px] text-state-error">
            Couldn’t refresh. Try again.
          </span>
        )}
      </div>
    </div>
  );
}
