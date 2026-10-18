import { Bell, ChevronRight, Inbox, Info, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  countUnmatchedDeposits,
  listUnmatchedDeposits,
} from "@/features/crypto-deposits/admin-queries";
import { PageHeader } from "@/components/shell/page-header";
import {
  DealChip,
  OwnerAvatar,
  ServiceIcon,
} from "@/features/deals/components/admin/parts";
import { DealsToolbar } from "@/features/deals/components/admin/DealsToolbar";
import { NewDealButton } from "@/features/deals/components/admin/NewDealDrawer";
import { dealAmountText, nairaText } from "@/features/deals/format";
import { getDealDeskContext } from "@/features/deals/public-queries";
import {
  countActiveDeals,
  countDealsNeedingAction,
  DEAL_FILTERS,
  getDealStats,
  listDeals,
  listMembers,
  listPayoutDue,
  SERVICE_FILTERS,
} from "@/features/deals/queries";
import { SERVICE_LABELS } from "@/features/deals/services";
import { waiting } from "@/features/deals/waiting";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { formatBoardDay, formatBoardTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Deals · RateBoard" };

const query = z.object({
  filter: z.enum(DEAL_FILTERS).catch("active"),
  q: z.string().max(60).optional().catch(undefined),
  service: z
    .string()
    .refine((s) => s in SERVICE_FILTERS)
    .optional()
    .catch(undefined),
  owner: z.string().max(40).optional().catch(undefined),
  cursor: z.string().max(200).optional().catch(undefined),
});

// "07:42" from seconds; negative is overdue.
function clock(seconds: number) {
  const s = Math.abs(Math.trunc(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const TONE = {
  normal: "text-text-secondary",
  soon: "text-deal-soon",
  late: "text-state-error",
} as const;

// deals.html: the team's queue. Stats, filters, and the deals newest first,
// 20 at a time; every row opens the deal.
export default async function DealsPage({
  searchParams,
}: PageProps<"/admin/deals">) {
  const { organizationId } = await requireMember();
  const params = query.parse(await searchParams);
  const now = new Date();
  // The org (its time zone feeds the stats) runs alongside the rest.
  const orgP = db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true, contactSlaMinutes: true },
  });
  // Crypto payouts due go on top of the first page (deals.html); the
  // rest of the list leaves them out so they never show twice.
  const dueOnTop = !params.cursor && !params.q && params.filter !== "completed";
  const [
    org,
    stats,
    needs,
    active,
    page,
    members,
    desk,
    due,
    unmatched,
    unmatchedRows,
  ] = await Promise.all([
    orgP,
    orgP.then((o) => getDealStats(organizationId, o.timezone, now)),
    countDealsNeedingAction(organizationId, now),
    countActiveDeals(organizationId),
    listDeals(
      organizationId,
      {
        ...params,
        exclude: params.filter !== "completed" ? ["DEPOSIT_COMPLETE"] : [],
      },
      now,
    ),
    listMembers(organizationId),
    getDealDeskContext(),
    params.filter !== "completed" && !params.q
      ? listPayoutDue(organizationId, params)
      : Promise.resolve([]),
    countUnmatchedDeposits(organizationId),
    listUnmatchedDeposits(organizationId),
  ]);
  const rows = dueOnTop ? [...due, ...page.deals] : page.deals;
  const owners = new Map(members.map((m) => [m.id, m]));
  const oldestNew = stats.oldestNewAt
    ? waiting("NEW", new Date(stats.oldestNewAt), now, org.contactSlaMinutes)
    : null;
  const filtered =
    params.filter !== "active" || params.q || params.service || params.owner;
  const nextHref = page.nextCursor
    ? `/admin/deals?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== "active")), cursor: page.nextCursor })}`
    : null;

  return (
    <>
      <PageHeader
        title="Deals"
        description="Every deal started on the website, from request to payout. Agree the final rate on WhatsApp, then move the deal along here."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/deals/wallets">
                <Wallet strokeWidth={1.9} />
                Wallets
              </Link>
            </Button>
            <NewDealButton
              boards={
                desk
                  ? { forex: desk.forex, pof: desk.pof }
                  : { forex: null, pof: null }
              }
            />
            {stats.firstPayout && (
              <Button asChild>
                <Link href={`/admin/deals/${stats.firstPayout.ref}`}>
                  <Bell strokeWidth={1.9} />
                  Payout due ({stats.payoutDue})
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-[22px] grid grid-cols-2 gap-3.5 wide:grid-cols-4">
        {[
          {
            k: "Payout due",
            v: stats.payoutDue,
            s: stats.firstPayout
              ? (() => {
                  const left =
                    (Date.parse(stats.firstPayout.dueAt) - now.getTime()) /
                    1000;
                  return `${stats.firstPayout.ref} · ${clock(left)} ${left < 0 ? "over" : "left"}`;
                })()
              : "Crypto payouts waiting",
            alert: stats.payoutDue > 0,
            pulse: stats.payoutDue > 0,
          },
          {
            k: "New, not contacted",
            v: stats.newCount,
            s: oldestNew ? `Oldest ${oldestNew.text}` : "None waiting",
            alert: oldestNew?.tone === "late",
          },
          {
            k: "Awaiting payment or deposit",
            v: stats.awaitingCount,
            s: `${nairaText(stats.awaitingNaira)} in progress`,
          },
          {
            k: "Completed today",
            v: stats.completedToday,
            s: `${nairaText(stats.completedTodayNaira)} completed`,
          },
        ].map((c) => (
          <div
            key={c.k}
            className={cn(
              "relative rounded-panel border bg-bg-surface px-[18px] py-4",
              c.alert
                ? "border-state-error/30 bg-state-error-soft/40"
                : "border-border-default",
            )}
          >
            {"pulse" in c && c.pulse && (
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 size-2.5 animate-pulse rounded-full bg-state-error ring-4 ring-state-error/15"
              />
            )}
            <div className="text-[13px] font-medium text-text-secondary">
              {c.k}
            </div>
            <div
              className={cn(
                "mt-1 text-[28px] leading-[1.15] font-[750] tracking-[-0.6px] tabular-nums",
                c.alert && "text-state-error",
              )}
            >
              {c.v}
            </div>
            <div className="text-[13px] text-text-muted">{c.s}</div>
          </div>
        ))}
      </div>

      <DealsToolbar
        counts={{ active, needs }}
        owners={members.map((m) => ({ id: m.id, name: m.name }))}
      />

      {unmatched > 0 && (
        <details className="mb-3.5 rounded-control border border-accent-gold bg-accent-gold-soft/50 px-4 py-3 text-[14px]">
          <summary className="cursor-pointer font-semibold text-accent-gold-text">
            {unmatched} deposit{unmatched > 1 ? "s" : ""} in the last 7 days
            matched no deal. Check {unmatched > 1 ? "them" : "it"} on the
            explorer before contacting anyone.
          </summary>
          <ul className="mt-2.5 grid gap-1.5">
            {unmatchedRows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3">
                <b className="tabular-nums">
                  {t.amount} {t.ticker}
                </b>
                <span className="text-text-secondary">
                  {t.network} ·{" "}
                  {formatBoardDay(new Date(t.blockTime), now, org.timezone)}{" "}
                  {formatBoardTime(new Date(t.blockTime), org.timezone)} · from{" "}
                  {t.fromAddress.slice(0, 4)}…{t.fromAddress.slice(-4)}
                </span>
                <a
                  href={t.explorerTx}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent-primary"
                >
                  View transfer
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtered ? "No deals match" : "No deals yet"}
          description={
            filtered
              ? "Try another filter or search."
              : "Deals started on the website appear here. Add one that started on WhatsApp with New deal."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
          <div className="hidden grid-cols-[minmax(190px,1.5fr)_minmax(120px,.9fr)_minmax(150px,1fr)_110px_20px] gap-4 border-b border-border-default bg-bg-subtle px-5 py-2.5 text-[12.5px] font-semibold text-text-muted sheet:grid wide:grid-cols-[minmax(210px,1.5fr)_minmax(130px,1fr)_minmax(120px,.9fr)_minmax(150px,1fr)_64px_110px_20px]">
            <span>Deal</span>
            <span className="hidden wide:block">Customer</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="hidden wide:block">Owner</span>
            <span className="text-right">Waiting</span>
            <span />
          </div>
          {rows.map((d) => {
            const base = waiting(
              d.status,
              new Date(d.statusChangedAt),
              now,
              org.contactSlaMinutes,
            );
            // Crypto: the payout timer, or nothing once closed.
            const dueIn = d.payoutDueAt
              ? (Date.parse(d.payoutDueAt) - now.getTime()) / 1000
              : null;
            const w =
              d.status === "DEPOSIT_COMPLETE" && dueIn !== null
                ? {
                    text: `${clock(dueIn)} ${dueIn < 0 ? "over" : "left"}`,
                    tone: "late" as const,
                  }
                : ["PAID_OUT", "EXPIRED"].includes(d.status)
                  ? { text: "—", tone: "normal" as const }
                  : d.status === "FLAGGED"
                    ? { ...base, tone: "late" as const }
                    : base;
            const lockLeft = d.lockExpiresAt
              ? (Date.parse(d.lockExpiresAt) - now.getTime()) / 1000
              : null;
            const naira =
              d.service === "CRYPTO_SELL"
                ? `${d.summary} · ${nairaText(d.agreedNaira ?? d.quotedNaira ?? "0")}`
                : d.agreedNaira
                  ? `${nairaText(d.agreedNaira)} agreed`
                  : d.quotedNaira
                    ? `${nairaText(d.quotedNaira)} est.`
                    : "To be quoted";
            const sub =
              d.status === "NEW"
                ? "Not yet contacted"
                : d.status === "AGREED"
                  ? "Share our account"
                  : d.status === "AWAITING_PAYMENT"
                    ? d.customerPaid
                      ? "Customer says paid"
                      : d.agreedAt
                        ? `Agreed ${formatBoardTime(new Date(d.agreedAt), org.timezone)}`
                        : ""
                    : d.status === "PAYMENT_RECEIVED"
                      ? "Send it on"
                      : d.status === "COMPLETED"
                        ? `${formatBoardDay(new Date(d.statusChangedAt), now, org.timezone)} ${formatBoardTime(new Date(d.statusChangedAt), org.timezone)}`
                        : d.status === "DEPOSIT_COMPLETE"
                          ? "Payout due"
                          : d.status === "AWAITING_DEPOSIT" && lockLeft !== null
                            ? lockLeft > 0
                              ? `Lock ${clock(lockLeft)} left`
                              : "Lock ended"
                            : d.status === "DEPOSIT_SEEN"
                              ? "Confirming on-chain"
                              : d.status === "FLAGGED"
                                ? "Check the deposit"
                                : d.status === "EXPIRED"
                                  ? "Re-quote or cancel"
                                  : d.status === "PAID_OUT" &&
                                      d.depositCompletedAt
                                    ? `in ${Math.max(1, Math.round((Date.parse(d.statusChangedAt) - Date.parse(d.depositCompletedAt)) / 60_000))} min`
                                    : "";
            return (
              <Link
                key={d.ref}
                href={`/admin/deals/${d.ref}`}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 border-b border-border-subtle px-4 py-3.5 last:border-b-0 hover:bg-bg-subtle sheet:grid-cols-[minmax(190px,1.5fr)_minmax(120px,.9fr)_minmax(150px,1fr)_110px_20px] sheet:gap-4 sheet:px-5 wide:grid-cols-[minmax(210px,1.5fr)_minmax(130px,1fr)_minmax(120px,.9fr)_minmax(150px,1fr)_64px_110px_20px]",
                  (w.tone === "late" || d.status === "DEPOSIT_COMPLETE") &&
                    "bg-state-error-soft/30",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ServiceIcon service={d.service} />
                  <div className="min-w-0">
                    <b className="block font-bold">{d.ref}</b>
                    <span className="block truncate text-[13px] text-text-secondary">
                      {SERVICE_LABELS[d.service]}
                      {d.summary && d.service !== "CRYPTO_SELL"
                        ? ` · ${d.summary}`
                        : ""}
                      <span className="wide:hidden"> · {d.customerName}</span>
                    </span>
                  </div>
                </div>
                <div className="hidden truncate text-[14.5px] font-semibold wide:block">
                  {d.customerName}
                </div>
                <div className="order-3 min-w-0 sheet:order-none">
                  <b className="block font-bold tabular-nums">
                    {dealAmountText(d.service, d.amount, d.currency)}
                  </b>
                  <span className="text-[12.5px] text-text-muted">{naira}</span>
                </div>
                <div className="justify-self-end sheet:justify-self-start">
                  <DealChip service={d.service} status={d.status} />
                  {sub && (
                    <span className="mt-[3px] block text-[12.5px] text-text-muted">
                      {sub}
                    </span>
                  )}
                </div>
                <div className="hidden wide:block">
                  <OwnerAvatar
                    owner={d.ownerId ? (owners.get(d.ownerId) ?? null) : null}
                  />
                </div>
                <div
                  className={cn(
                    "order-4 self-end text-right text-[13.5px] font-[650] tabular-nums sheet:order-none sheet:self-auto",
                    TONE[w.tone],
                  )}
                >
                  {w.text}
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="hidden size-4 text-text-muted sheet:block"
                  strokeWidth={1.9}
                />
              </Link>
            );
          })}
        </div>
      )}
      {nextHref && (
        <div className="mt-3.5 text-center">
          <Link
            href={nextHref}
            className="text-[14px] font-semibold text-accent-primary"
          >
            Older deals →
          </Link>
        </div>
      )}
      <p className="mt-4 flex gap-2.5 rounded-control bg-accent-soft px-3.5 py-3 text-[13.5px] text-accent-primary-hover">
        <Info
          aria-hidden="true"
          className="mt-px size-4 shrink-0"
          strokeWidth={1.9}
        />
        “Waiting” is time since the last status change. Crypto deals move to
        Deposit complete automatically once the blockchain check passes;
        everything else is moved by your team.
      </p>
    </>
  );
}
