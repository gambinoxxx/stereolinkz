"use client";

import { Check, Copy, ExternalLink, Info, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  agreeCryptoPayout,
  confirmDepositManually,
  markPaidOut,
  requoteCryptoDeal,
} from "@/features/crypto-deposits/actions";
import type { TeamCrypto } from "@/features/crypto-deposits/admin-queries";
import type { CheckKey } from "@/features/crypto-deposits/check";
import { explorerName, NETWORKS } from "@/features/crypto-deposits/tokens";
import { KV, Panel } from "@/features/deals/components/admin/parts";
import { nairaText } from "@/features/deals/format";
import type { TeamDeal } from "@/features/deals/queries";
import type { NameCheck } from "@/features/deals/schema";
import { formatAccountNumber } from "@/features/deals/settings-schema";
import { Select } from "@/features/settings/components/settings-parts";
import type { ActionResult } from "@/lib/server/action";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Labels = { when: Record<string, string>; time: Record<string, string> };
const lbl = (map: Record<string, string>, iso: string | null) =>
  iso ? (map[iso] ?? "") : "";
const ends = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;
function coins(qty: string) {
  const [int = "0", frac = ""] = qty.split(".");
  return `${formatRate(int)}.${frac.padEnd(2, "0")}`;
}

function CopyBtn({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copied");
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
    >
      <Copy strokeWidth={1.9} />
      {label}
    </Button>
  );
}

function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = <T,>(
    action: () => Promise<ActionResult<T>>,
    success: string,
    after?: () => void,
  ) =>
    start(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      after?.();
      toast.success(success);
      router.refresh();
    });
  return { busy, errors, run };
}

// ── Deposit check (deal-detail-crypto.html) ───────────────────────────

const CHECK_LABEL = (c: TeamCrypto): Record<CheckKey, string> => ({
  destination: "Sent to our address",
  contract: `Official ${c.ticker} contract on ${NETWORKS[c.network].chain}`,
  network: "Network matches the deal",
  amount: "Amount received",
  confirmations: "Confirmations",
  lock: "Within the rate lock",
});

export function CryptoCheckPanel({
  deal,
  crypto: c,
  labels,
}: {
  deal: TeamDeal;
  crypto: TeamCrypto;
  labels: Labels;
}) {
  const t = c.transfer;
  const minutesIn = t
    ? Math.max(
        0,
        Math.round(
          (Date.parse(t.blockTime) - Date.parse(deal.createdAt)) / 60_000,
        ),
      )
    : null;
  const values: Record<CheckKey, string> = {
    destination: ends(t?.toAddress ?? c.depositAddress),
    contract: ends(t?.tokenContract ?? c.officialContract ?? "—"),
    network: t?.network ?? c.network,
    amount: `${t ? coins(t.amount) : "—"} / ${coins(c.expectedQty)} ${c.ticker}`,
    confirmations: `${Math.min(c.confirmations ?? 0, c.minConfirmations)} / ${c.minConfirmations}`,
    lock:
      minutesIn === null
        ? `Lock ends ${lbl(labels.time, c.lockExpiresAt)}`
        : `Received ${minutesIn} min after start (lock ${c.lockMinutes} min)`,
  };
  const names = CHECK_LABEL(c);
  const aside =
    deal.status === "FLAGGED" ? (
      <Badge variant="destructive">Flagged</Badge>
    ) : deal.status === "EXPIRED" ? (
      <Badge>Rate lock ended</Badge>
    ) : deal.status === "RATE_TO_AGREE" ? (
      <Badge variant="gold">Coins received · rate to agree</Badge>
    ) : c.depositCompletedAt &&
      (deal.status === "DEPOSIT_COMPLETE" || deal.status === "PAID_OUT") ? (
      <Badge variant="success">
        {deal.events.some((e) =>
          e.message.startsWith("Deposit confirmed manually"),
        )
          ? "Confirmed manually"
          : "Verified automatically"}{" "}
        · {lbl(labels.time, c.depositCompletedAt)}
      </Badge>
    ) : deal.status === "DEPOSIT_SEEN" ? (
      <Badge variant="brand">
        Confirming · {Math.min(c.confirmations ?? 0, c.minConfirmations)} /{" "}
        {c.minConfirmations}
      </Badge>
    ) : (
      <Badge variant="brand">Watching for the deposit</Badge>
    );

  return (
    <Panel title="Deposit check" aside={aside}>
      <ul className="grid gap-2.5">
        {(Object.keys(names) as CheckKey[]).map((k) => {
          const ok = c.checks?.[k];
          return (
            <li key={k} className="flex items-center gap-3 text-[14.5px]">
              <span
                aria-label={
                  ok === undefined
                    ? "Not checked yet"
                    : ok
                      ? "Passed"
                      : "Failed"
                }
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-white",
                  ok === undefined
                    ? "bg-border-subtle text-text-muted"
                    : ok
                      ? "bg-state-success"
                      : "bg-state-error",
                )}
              >
                {ok === undefined ? (
                  <span className="size-1.5 rounded-full bg-current" />
                ) : ok ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <X className="size-3.5" strokeWidth={3} />
                )}
              </span>
              <span className="min-w-0 flex-1">{names[k]}</span>
              <span className="text-right font-semibold tabular-nums">
                {values[k]}
              </span>
            </li>
          );
        })}
      </ul>
      {c.flagReason &&
        (deal.status === "FLAGGED" || deal.status === "EXPIRED") && (
          <p className="mt-3.5 rounded-control bg-state-error-soft px-3.5 py-2.5 text-[14px] text-state-error">
            <b>Reason:</b> {c.flagReason}
          </p>
        )}
      {c.txHash && (
        <div className="mt-4">
          <div className="mb-1.5 text-[13.5px] font-semibold">
            Transaction ID
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-border-default px-3 py-2">
            <code className="min-w-0 flex-1 text-[12.5px] break-all">
              {c.txHash}
            </code>
            <CopyBtn value={c.txHash} />
            {c.explorerTx && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={c.explorerTx}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {explorerName(c.network)}
                  <ExternalLink strokeWidth={1.9} />
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
      <p className="mt-4 flex gap-2.5 rounded-control bg-accent-soft px-3.5 py-3 text-[13.5px] text-accent-primary">
        <Info
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          strokeWidth={1.9}
        />
        <span>
          The app only watches our addresses (read-only). It never holds keys or
          sends crypto. If any check fails, the deal is <b>Flagged</b> and never
          auto-confirmed.
        </span>
      </p>
    </Panel>
  );
}

// ── Pay out ───────────────────────────────────────────────────────────

function PayoutTimer({
  dueAt,
  totalMinutes,
  naira,
  dueLabel,
}: {
  dueAt: string;
  totalMinutes: number;
  naira: string;
  dueLabel: string;
}) {
  const due = Date.parse(dueAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  const left = now === null ? null : Math.floor((due - now) / 1000);
  const late = left !== null && left < 0;
  const s = Math.abs(left ?? 0);
  const text = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const p =
    left === null ? 1 : Math.max(0, Math.min(1, left / (totalMinutes * 60)));
  return (
    <div className="flex items-center gap-4 rounded-panel bg-bg-sidebar px-5 py-4 text-white">
      <span
        className="grid size-[62px] shrink-0 place-items-center rounded-full"
        style={
          {
            background: `conic-gradient(var(--accent-gold) ${p * 360}deg, rgb(255 255 255 / .12) 0)`,
          } as CSSProperties
        }
      >
        <span className="grid size-[50px] place-items-center rounded-full bg-bg-sidebar text-[12px] font-extrabold">
          {Math.round(p * 100)}%
        </span>
      </span>
      <div>
        <b
          className={cn(
            "block text-[30px] leading-none font-black tracking-[-0.5px] tabular-nums",
            late ? "text-state-error-soft" : "text-accent-gold",
          )}
        >
          {left === null ? "--:--" : late ? `+${text}` : text}
        </b>
        <span className="text-[13.5px] text-white/70">
          {late
            ? `overdue · ${naira} was due ${dueLabel}`
            : `left to pay ${naira} · due ${dueLabel}`}
        </span>
      </div>
    </div>
  );
}

const NAME_BADGE: Record<NameCheck, ReactNode> = {
  MATCH: <Badge variant="success">Matches customer</Badge>,
  CLOSE: <Badge variant="gold">Partly matches: check</Badge>,
  DIFFERENT: <Badge variant="destructive">Name differs: check first</Badge>,
};

export function CryptoPayoutPanel({
  deal,
  crypto: c,
  labels,
}: {
  deal: TeamDeal;
  crypto: TeamCrypto;
  labels: Labels;
}) {
  const id = useId();
  const { busy, errors, run } = useRun();
  const [reference, setReference] = useState("");
  const [from, setFrom] = useState(
    deal.accounts.find((a) => a.active)?.id ?? "",
  );
  const naira = nairaText(deal.agreedNaira ?? deal.quotedNaira ?? "0");
  const paid = deal.status === "PAID_OUT";
  const det = deal.details;
  const check = det?.service === "CRYPTO_SELL" ? det.payoutNameCheck : null;
  const paidFrom = deal.accounts.find((a) => a.id === deal.paidFromAccountId);

  return (
    <Panel
      id="payout"
      title="Pay out"
      aside={
        <span className="text-[13px] text-text-muted">
          Target {c.payoutMinutes} min after deposit
        </span>
      }
    >
      {!paid && c.payoutDueAt && (
        <PayoutTimer
          dueAt={c.payoutDueAt}
          totalMinutes={c.payoutMinutes}
          naira={naira}
          dueLabel={lbl(labels.time, c.payoutDueAt)}
        />
      )}
      <div className="mt-4">
        <KV
          rows={[
            [
              "Pay",
              <span key="p" className="flex flex-wrap items-center gap-2">
                <span className="text-[17px] tabular-nums">{naira}</span>
                <CopyBtn
                  value={(deal.agreedNaira ?? deal.quotedNaira ?? "0").replace(
                    /\.\d+$/,
                    "",
                  )}
                />
              </span>,
            ],
            ["Bank", deal.payoutBank ?? "—"],
            [
              "Account",
              <span key="a" className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  {formatAccountNumber(deal.payoutAccountNumber ?? "")}
                </span>
                {deal.payoutAccountNumber && (
                  <CopyBtn value={deal.payoutAccountNumber} />
                )}
              </span>,
            ],
            [
              "Name",
              <span key="n" className="flex flex-wrap items-center gap-2">
                {deal.payoutAccountName}
                {check && NAME_BADGE[check]}
              </span>,
            ],
            ...(paid
              ? ([
                  ["Reference", deal.payoutReference ?? "—"],
                  [
                    "Paid from",
                    paidFrom
                      ? `${paidFrom.bank} · ${paidFrom.accountName}`
                      : "—",
                  ],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      </div>
      {!paid && (
        <>
          <div className="mt-4 grid gap-3.5 sheet:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-ref`}>Bank transfer reference</Label>
              <Input
                id={`${id}-ref`}
                value={reference}
                placeholder="From your banking app"
                onChange={(e) => setReference(e.target.value)}
                aria-invalid={errors.reference ? true : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-from`}>Paid from</Label>
              <Select
                id={`${id}-from`}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-invalid={errors.paidFromAccountId ? true : undefined}
              >
                {deal.accounts.length === 0 && (
                  <option value="">
                    Add a crypto payout account in Settings
                  </option>
                )}
                {deal.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank} · {a.accountName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            className="mt-3.5 w-full"
            disabled={busy || reference.trim().length < 3 || !from}
            onClick={() =>
              run(
                () =>
                  markPaidOut({
                    ref: deal.ref,
                    reference,
                    paidFromAccountId: from,
                  }),
                "Paid out. The customer’s page is updated.",
              )
            }
          >
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Check strokeWidth={2.2} />
            )}
            Mark paid out and notify the customer
          </Button>
          <p className="mt-2.5 text-[13px] text-text-muted">
            The customer’s page switches to “{naira} sent” with your reference.
            If the timer runs out first, they see “Taking a little longer, our
            team has been alerted”.
          </p>
        </>
      )}
    </Panel>
  );
}

// ── Flagged or expired: confirm manually / re-quote ───────────────────

export function CryptoReviewPanel({
  deal,
  crypto: c,
  currentRate,
}: {
  deal: TeamDeal;
  crypto: TeamCrypto;
  currentRate: string | null;
}) {
  const id = useId();
  const { busy, errors, run } = useRun();
  const [reason, setReason] = useState("");
  const [rate, setRate] = useState(
    currentRate ?? deal.agreedRate ?? deal.quotedRate ?? "",
  );
  const flagged = deal.status === "FLAGGED";
  return (
    <Panel title={flagged ? "Review the deposit" : "Re-quote"}>
      {flagged && (
        <div className="mb-5">
          <Label htmlFor={`${id}-why`}>Confirm the deposit manually</Label>
          <Textarea
            id={`${id}-why`}
            rows={2}
            className="mt-1.5"
            placeholder="What you checked, e.g. Tronscan shows 500 USDT from the customer’s wallet"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={errors.reason ? true : undefined}
          />
          <Button
            className="mt-2.5"
            disabled={busy || reason.trim().length < 5}
            onClick={() =>
              run(
                () => confirmDepositManually({ ref: deal.ref, reason }),
                "Deposit confirmed. Payout is due.",
                () => setReason(""),
              )
            }
          >
            Confirm deposit manually
          </Button>
          <p className="mt-2 text-[13px] text-text-muted">
            Logged with your name and reason. Only confirm after checking the
            transfer on {explorerName(c.network)}.
          </p>
        </div>
      )}
      <Label htmlFor={`${id}-rate`}>New rate (₦ per $1)</Label>
      <div className="mt-1.5 flex flex-wrap gap-2.5">
        <Input
          id={`${id}-rate`}
          inputMode="decimal"
          className="max-w-[180px]"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          aria-invalid={errors.rate ? true : undefined}
        />
        <Button
          variant="outline"
          disabled={busy || !rate.trim()}
          onClick={() =>
            run(
              () => requoteCryptoDeal({ ref: deal.ref, rate }),
              "Re-quoted. The customer has a new rate lock.",
            )
          }
        >
          Re-quote
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-text-muted">
        Gives the customer a new {c.lockMinutes} min lock at this rate on the
        same address and amount. A late deposit already received is then checked
        again.
        {currentRate ? ` Latest board: ₦${formatRate(currentRate)}.` : ""}
      </p>
    </Panel>
  );
}

// ── Deal summary (right column) ───────────────────────────────────────

export function CryptoDealPanel({
  deal,
  crypto: c,
  labels,
}: {
  deal: TeamDeal;
  crypto: TeamCrypto;
  labels: Labels;
}) {
  const rate = deal.agreedRate ?? deal.quotedRate;
  return (
    <Panel title="Deal">
      <KV
        rows={[
          ["Coin", `${c.ticker} · ${c.network}`],
          ["Expected", `${coins(c.expectedQty)} ${c.ticker}`],
          [
            "Rate",
            rate
              ? `₦${formatRate(rate)} per $1 (${deal.agreedRate ? "re-quoted" : `locked ${lbl(labels.time, deal.createdAt)}`})`
              : "—",
          ],
          ...(c.market
            ? ([
                [
                  "Quoted",
                  `$${c.market.quoteUsd} at $${formatRate(c.market.quotePrice)} per ${c.ticker}`,
                ],
                [
                  "Conversion fee",
                  `$${c.market.feeUsd} · payout $${c.market.payoutUsd}`,
                ],
                [
                  "At confirmation",
                  c.market.confirmPrice
                    ? `$${formatRate(c.market.confirmPrice)} per ${c.ticker} · coins worth $${c.market.valueAtConfirm ?? "—"}`
                    : "Not confirmed yet",
                ],
              ] as [string, ReactNode][])
            : []),
          ["Payout", nairaText(deal.agreedNaira ?? deal.quotedNaira ?? "0")],
          [
            "Deposit address",
            <code key="d" className="text-[12.5px] font-bold break-all">
              {c.depositAddress}
            </code>,
          ],
        ]}
      />
    </Panel>
  );
}

// ── BTC: the price moved past the margin (RATE_TO_AGREE) ──────────────

export function CryptoAgreePanel({
  deal,
  crypto: c,
  boardRate,
}: {
  deal: TeamDeal;
  crypto: TeamCrypto;
  boardRate: string | null;
}) {
  const id = useId();
  const { busy, errors, run } = useRun();
  const m = c.market;
  // A starting point: the coins' value at confirmation, less the fee, at
  // the deal's rate. The team agrees the final figure on WhatsApp.
  const rate = deal.agreedRate ?? deal.quotedRate ?? boardRate;
  const suggested =
    m?.valueAtConfirm && rate
      ? Math.max(
          0,
          Math.floor(
            (Number(m.valueAtConfirm) - Number(m.feeUsd)) * Number(rate),
          ),
        ).toString()
      : "";
  const [naira, setNaira] = useState(suggested);
  const [note, setNote] = useState("");
  return (
    <Panel title="Agree the payout">
      <p className="text-[14px] text-text-secondary">
        The coins arrived, but the {c.ticker} price moved past the margin while
        they confirmed
        {m?.valueAtConfirm
          ? ` (worth $${m.valueAtConfirm}, payout was $${m.payoutUsd})`
          : ""}
        . Agree the amount with the customer on WhatsApp, then record it here.
        The payout timer starts when you save.
      </p>
      <div className="mt-3.5 grid gap-3.5 sheet:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-naira`}>Agreed payout (₦)</Label>
          <Input
            id={`${id}-naira`}
            inputMode="decimal"
            value={naira}
            onChange={(e) => setNaira(e.target.value)}
            aria-invalid={errors.naira ? true : undefined}
          />
          {suggested && (
            <span className="text-[12.5px] text-text-muted">
              Suggested from the price at confirmation: ₦{formatRate(suggested)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>What you agreed</Label>
          <Input
            id={`${id}-note`}
            value={note}
            placeholder="e.g. Agreed ₦520,000 with Chinedu on WhatsApp"
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={errors.note ? true : undefined}
          />
        </div>
      </div>
      <Button
        className="mt-3.5"
        disabled={busy || !naira.trim() || note.trim().length < 3}
        onClick={() =>
          run(
            () => agreeCryptoPayout({ ref: deal.ref, naira, note }),
            "Payout agreed. The payout timer has started.",
          )
        }
      >
        {busy && <Loader2 className="animate-spin" />}
        Save and start the payout
      </Button>
    </Panel>
  );
}
