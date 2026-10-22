"use client";

import { Check, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVICE_LABELS } from "@/features/deals/services";
import {
  approveRewards,
  clearRewardFlag,
  payRewards,
  voidReward,
} from "@/features/referrals/actions";
import { STATUS_LABELS } from "@/features/referrals/labels";
import type { LedgerFilters, LedgerRow } from "@/features/referrals/queries";
import type { RewardDisplayStatus } from "@/features/referrals/rules";
import { Select } from "@/features/settings/components/settings-parts";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Gift } from "lucide-react";

const naira = (v: string) => `₦${formatRate(v.replace(/\.0+$/, ""))}`;

const VARIANT: Record<
  RewardDisplayStatus,
  "default" | "success" | "brand" | "gold" | "destructive"
> = {
  PENDING: "default",
  READY: "gold",
  APPROVED: "brand",
  PAID: "success",
  VOID: "destructive",
};

const day = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

export function LedgerView({
  isOwner,
  filters,
  rows,
  totals,
  counts,
  referrers,
  timeZone,
  today,
}: {
  isOwner: boolean;
  filters: LedgerFilters;
  rows: LedgerRow[];
  totals: Record<"PENDING" | "READY" | "APPROVED" | "PAID", string>;
  counts: Record<RewardDisplayStatus, number>;
  referrers: { key: string; name: string }[];
  timeZone: string;
  today: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pay, setPay] = useState({ bankReference: "", paidOn: today });
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(
    null,
  );

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next}`);
  };
  const ready = rows.filter((r) => r.status === "READY");
  const selectedApproved = useMemo(
    () => rows.filter((r) => selected.has(r.id) && r.status === "APPROVED"),
    [rows, selected],
  );
  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) =>
    start(async () => {
      const r = await action();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong.");
      toast.success(success);
      setSelected(new Set());
      setVoiding(null);
      router.refresh();
    });
  const csv = `/api/referrals/export?${new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Rewards for referred deals: a share of our profit on each. They wait out the hold, then the owner approves and pays them."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={csv}>
                <Download strokeWidth={1.9} />
                Export CSV
              </a>
            </Button>
            {isOwner && (
              <Button
                disabled={busy || ready.length === 0}
                onClick={() =>
                  start(async () => {
                    const r = await approveRewards({
                      ids: ready.map((x) => x.id),
                    });
                    if (!r.ok) return void toast.error(r.error);
                    if (r.data.skipped.length)
                      toast.warning(r.data.skipped.join(". "));
                    toast.success(`${r.data.approved} approved`);
                    router.refresh();
                  })
                }
              >
                <Check strokeWidth={1.9} />
                Approve ready ({ready.length})
              </Button>
            )}
          </>
        }
      />

      <div className="mb-[22px] grid grid-cols-2 gap-3.5 wide:grid-cols-4">
        {(
          [
            ["PENDING", "Pending", "In the hold or waiting"],
            ["READY", "Ready", "Hold over, to approve"],
            ["APPROVED", "Approved", "To pay"],
            ["PAID", "Paid", "Paid out"],
          ] as const
        ).map(([key, label, sub]) => (
          <div
            key={key}
            className="rounded-panel border border-border-default bg-bg-surface px-[18px] py-4"
          >
            <div className="text-[13px] font-medium text-text-secondary">
              {label}
            </div>
            <div className="mt-1 text-[28px] leading-[1.15] font-[750] tracking-[-0.6px] tabular-nums">
              {naira(totals[key])}
            </div>
            <div className="text-[13px] text-text-muted">{sub}</div>
          </div>
        ))}
      </div>

      <nav
        aria-label="Rewards by status"
        className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1"
      >
        {(
          [
            [
              "",
              "All",
              counts.PENDING +
                counts.READY +
                counts.APPROVED +
                counts.PAID +
                counts.VOID,
            ],
            ["PENDING", "On hold", counts.PENDING],
            ["READY", "Ready", counts.READY],
            ["APPROVED", "Approved", counts.APPROVED],
            ["PAID", "Paid", counts.PAID],
            ["VOID", "Void", counts.VOID],
          ] as const
        ).map(([key, label, n]) => {
          const on = (filters.status ?? "") === key;
          const next = new URLSearchParams(params);
          if (key) next.set("status", key);
          else next.delete("status");
          return (
            <Link
              key={label}
              href={`${pathname}?${next}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap",
                on
                  ? "border-accent-primary bg-accent-soft text-accent-primary-hover"
                  : "border-border-default bg-bg-surface text-text-secondary hover:text-text-primary",
              )}
            >
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-3.5 grid gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-ref`}>Referrer</Label>
          <Select
            id={`${id}-ref`}
            value={filters.referrer ?? ""}
            onChange={(e) => setFilter("referrer", e.target.value)}
          >
            <option value="">Everyone</option>
            {referrers.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <Select
            id={`${id}-status`}
            value={filters.status ?? ""}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">All</option>
            {(Object.keys(STATUS_LABELS) as RewardDisplayStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-month`}>Month</Label>
          <Input
            id={`${id}-month`}
            type="month"
            value={filters.month ?? ""}
            onChange={(e) => setFilter("month", e.target.value)}
          />
        </div>
      </div>

      {isOwner && selectedApproved.length > 0 && (
        <div className="mb-3.5 grid items-end gap-2.5 rounded-control border border-accent-primary/30 bg-accent-soft px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-bref`}>
              Bank reference ({selectedApproved.length} selected,{" "}
              {naira(
                selectedApproved
                  .reduce(
                    (t, r) => t + BigInt(r.amountNaira.split(".")[0]!),
                    BigInt(0),
                  )
                  .toString(),
              )}
              )
            </Label>
            <Input
              id={`${id}-bref`}
              value={pay.bankReference}
              onChange={(e) =>
                setPay((s) => ({ ...s, bankReference: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-paid`}>Paid on</Label>
            <Input
              id={`${id}-paid`}
              type="date"
              value={pay.paidOn}
              onChange={(e) =>
                setPay((s) => ({ ...s, paidOn: e.target.value }))
              }
            />
          </div>
          <Button
            disabled={busy || pay.bankReference.trim().length < 3}
            onClick={() =>
              run(
                () =>
                  payRewards({
                    ids: selectedApproved.map((r) => r.id),
                    ...pay,
                  }),
                "Marked paid",
              )
            }
          >
            {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
            Mark paid
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No rewards yet"
          description="A reward appears when a deal with a referral code is completed with our profit entered."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
          <div className="hidden grid-cols-[28px_minmax(120px,1fr)_minmax(110px,.9fr)_minmax(110px,.8fr)_minmax(110px,.8fr)_minmax(140px,1fr)] gap-4 border-b border-border-default bg-bg-subtle px-5 py-2.5 text-[12.5px] font-semibold text-text-muted sheet:grid">
            <span />
            <span>Deal</span>
            <span>Referrer</span>
            <span className="text-right">Our profit</span>
            <span className="text-right">Reward</span>
            <span>Status</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="border-b border-border-subtle px-4 py-3.5 last:border-b-0 sheet:px-5"
            >
              <div className="grid grid-cols-[28px_1fr_auto] items-center gap-x-3 gap-y-1.5 sheet:grid-cols-[28px_minmax(120px,1fr)_minmax(110px,.9fr)_minmax(110px,.8fr)_minmax(110px,.8fr)_minmax(140px,1fr)] sheet:gap-4">
                <span>
                  {isOwner && r.status === "APPROVED" && (
                    <Checkbox
                      aria-label={`Select ${r.dealRef}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={(on) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (on) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/admin/deals/${r.dealRef}`}
                    className="font-bold hover:underline"
                  >
                    {r.dealRef}
                  </Link>
                  <span className="block truncate text-[13px] text-text-secondary">
                    {SERVICE_LABELS[r.service]} · {day(r.createdAt, timeZone)}
                  </span>
                </div>
                <div className="col-start-2 min-w-0 text-[14px] sheet:col-start-auto">
                  <b className="font-semibold">{r.referrer}</b>
                  <span className="block font-mono text-[12.5px] text-text-muted">
                    {r.code}
                  </span>
                </div>
                <div className="hidden text-right text-[14px] tabular-nums sheet:block">
                  {naira(r.profitNaira)}
                  <span className="block text-[12.5px] text-text-muted">
                    {r.pct}%
                  </span>
                </div>
                <div className="col-start-3 row-start-1 text-right font-bold tabular-nums sheet:col-start-auto sheet:row-start-auto">
                  {naira(r.amountNaira)}
                </div>
                <div className="col-start-2 sheet:col-start-auto">
                  <Badge variant={VARIANT[r.status]}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                  <span
                    className={cn(
                      "mt-1 block text-[12.5px]",
                      r.flagged ? "text-state-error" : "text-text-muted",
                    )}
                  >
                    {r.status === "PAID" && r.paidAt
                      ? `${day(r.paidAt, timeZone)} · ${r.bankReference}`
                      : r.readyOn
                        ? `${r.note === "In the hold period" ? "On hold" : r.note} · Ready on ${day(r.readyOn, timeZone)}`
                        : r.note}
                  </span>
                </div>
              </div>
              {isOwner &&
                (r.status === "PENDING" ||
                  r.status === "READY" ||
                  r.status === "APPROVED") && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-[40px]">
                    {r.flagged && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(() => clearRewardFlag(r.id), "Flag cleared")
                        }
                      >
                        I’ve checked it: clear the flag
                      </Button>
                    )}
                    {voiding?.id === r.id ? (
                      <>
                        <Input
                          aria-label={`Why void ${r.dealRef}`}
                          placeholder="Why? e.g. the deal was reversed"
                          className="h-8 max-w-[300px]"
                          value={voiding.reason}
                          onChange={(e) =>
                            setVoiding({ id: r.id, reason: e.target.value })
                          }
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || voiding.reason.trim().length < 5}
                          onClick={() =>
                            run(
                              () =>
                                voidReward({
                                  id: r.id,
                                  reason: voiding.reason,
                                }),
                              "Reward voided",
                            )
                          }
                        >
                          Void reward
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVoiding(null)}
                        >
                          Keep it
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVoiding({ id: r.id, reason: "" })}
                      >
                        Void…
                      </Button>
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
