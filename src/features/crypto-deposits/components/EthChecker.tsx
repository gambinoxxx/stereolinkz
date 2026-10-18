"use client";

import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { EthCheck } from "@/features/crypto-deposits/providers/eth";
import type { ActionResult } from "@/lib/server/action";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000;

// The ETH transfer checker (Phase 13b): paste a transaction hash, see
// whether it reached our ETH address, the amount, and its confirmations,
// refreshed every 15 s until final. The same check for customers
// (public page, deal.css look) and the team (admin, app tokens).
export function EthChecker({
  check,
  variant,
}: {
  check: (raw: { txHash: string }) => Promise<ActionResult<EthCheck>>;
  variant: "customer" | "team";
}) {
  const id = useId();
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EthCheck | null>(null);
  const current = useRef<string | null>(null);

  async function run(hash: string) {
    setBusy(true);
    const r = await check({ txHash: hash });
    setBusy(false);
    if (current.current !== hash) return; // a newer hash was pasted
    if (!r.ok) {
      setError(r.error);
      setResult(null);
      return;
    }
    setError(null);
    setResult(r.data);
  }

  // Keep a found, not-yet-final transfer up to date.
  useEffect(() => {
    if (result?.state !== "FOUND" || !current.current) return;
    if (result.status === "FAILED") return;
    if (result.confirmations >= result.finalAfter) return;
    const hash = current.current;
    const t = window.setTimeout(() => void run(hash), REFRESH_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const c = variant === "customer";
  const ok = result?.state === "FOUND" && result.status !== "FAILED";
  const found = result?.state === "FOUND" ? result : null;
  const pct = found
    ? Math.min(100, (found.confirmations / found.finalAfter) * 100)
    : 0;

  return (
    <div className={c ? "fields" : "flex flex-col gap-3"}>
      <div className={c ? "fld" : "flex flex-col gap-1.5"}>
        <label
          htmlFor={`${id}-tx`}
          className={c ? undefined : "text-[13.5px] font-semibold"}
        >
          ETH transaction hash
        </label>
        <input
          id={`${id}-tx`}
          className={
            c
              ? "inp"
              : "h-10 rounded-control border border-border-default bg-bg-surface px-3 font-mono text-[13.5px]"
          }
          style={c ? { fontFamily: "ui-monospace, monospace" } : undefined}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          value={tx}
          onChange={(e) => setTx(e.target.value)}
        />
      </div>
      <button
        type="button"
        className={
          c
            ? "btn dark"
            : "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 text-[14px] font-semibold text-white disabled:opacity-60"
        }
        disabled={busy || !tx.trim()}
        onClick={() => {
          current.current = tx.trim();
          void run(tx.trim());
        }}
      >
        {busy && (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        )}
        Check transfer
      </button>

      {error && (
        <p
          className={c ? "note bad" : "text-[14px] text-state-error"}
          role="alert"
        >
          {error}
        </p>
      )}

      {result && result.state !== "FOUND" && (
        <p
          className={c ? "note warn" : "text-[14px] text-accent-gold-text"}
          role="status"
        >
          {result.state === "NOT_FOUND"
            ? "We can’t find that transaction on Ethereum yet. Check the hash, or try again in a minute."
            : result.state === "NOT_OURS"
              ? "That transaction wasn’t sent to our ETH address. Only send to the address our team gives you on WhatsApp."
              : "That transaction isn’t a plain ETH transfer (it looks like a token or contract call). Message us on WhatsApp."}
        </p>
      )}

      {found && (
        <div
          className={
            c
              ? "card"
              : "rounded-panel border border-border-default bg-bg-surface p-4"
          }
          role="status"
          aria-live="polite"
          style={c ? { margin: 0, padding: 18 } : undefined}
        >
          <ul className={c ? "kv" : "grid gap-1.5 text-[14px]"}>
            {(
              [
                ["Sent to our ETH address", true],
                [`${found.valueEth} ETH`, true],
                [
                  found.status === "SUCCESS"
                    ? "Transaction succeeded"
                    : found.status === "PENDING"
                      ? "Waiting to be included in a block"
                      : "Transaction failed on-chain",
                  found.status !== "FAILED",
                ],
              ] as const
            ).map(([label, good]) => (
              <li key={label} className="flex items-center gap-2">
                {good ? (
                  <Check
                    size={16}
                    strokeWidth={3}
                    className={c ? undefined : "text-state-success"}
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    size={16}
                    strokeWidth={3}
                    className={c ? undefined : "text-state-error"}
                    aria-hidden="true"
                  />
                )}
                {label}
              </li>
            ))}
          </ul>
          {ok && (
            <>
              <div
                className={
                  c
                    ? undefined
                    : "mt-3 flex justify-between text-[13.5px] font-semibold"
                }
                style={
                  c
                    ? {
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                        fontSize: 14.5,
                        marginTop: 14,
                      }
                    : undefined
                }
              >
                <span>Confirmations</span>
                <span className="tabular-nums">
                  {Math.min(found.confirmations, found.finalAfter)} /{" "}
                  {found.finalAfter}
                  {found.confirmations >= found.finalAfter ? " · final" : ""}
                </span>
              </div>
              <div
                className={
                  c
                    ? "conf"
                    : "mt-1.5 h-2 overflow-hidden rounded bg-border-subtle"
                }
              >
                <i
                  className={
                    c ? undefined : cn("block h-full rounded bg-accent-primary")
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
          <a
            href={found.explorerTx}
            target="_blank"
            rel="noopener noreferrer"
            className={
              c
                ? undefined
                : "mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-primary"
            }
            style={
              c
                ? {
                    display: "inline-flex",
                    gap: 6,
                    marginTop: 12,
                    color: "var(--violet)",
                    fontWeight: 700,
                  }
                : undefined
            }
          >
            View on Etherscan <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}
