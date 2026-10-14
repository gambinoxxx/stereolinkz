import { ChevronRight, Inbox, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
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
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true, contactSlaMinutes: true },
  });
  const [stats, needs, active, page, members, desk] = await Promise.all([
    getDealStats(organizationId, org.timezone, now),
    countDealsNeedingAction(organizationId, now),
    countActiveDeals(organizationId),
    listDeals(organizationId, params, now),
    listMembers(organizationId),
    getDealDeskContext(),
  ]);
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
          <NewDealButton
            boards={
              desk
                ? { forex: desk.forex, pof: desk.pof }
                : { forex: null, pof: null }
            }
          />
        }
      />

      <div className="mb-[22px] grid grid-cols-2 gap-3.5 shell:grid-cols-3">
        {[
          {
            k: "New, not contacted",
            v: stats.newCount,
            s: oldestNew ? `Oldest ${oldestNew.text}` : "None waiting",
            alert: oldestNew?.tone === "late",
          },
          {
            k: "Awaiting payment",
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
              "rounded-panel border bg-bg-surface px-[18px] py-4",
              c.alert
                ? "border-state-error/30 bg-state-error-soft/40"
                : "border-border-default",
            )}
          >
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

      {page.deals.length === 0 ? (
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
          {page.deals.map((d) => {
            const w = waiting(
              d.status,
              new Date(d.statusChangedAt),
              now,
              org.contactSlaMinutes,
            );
            const naira = d.agreedNaira
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
                        : "";
            return (
              <Link
                key={d.ref}
                href={`/admin/deals/${d.ref}`}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5 border-b border-border-subtle px-4 py-3.5 last:border-b-0 hover:bg-bg-subtle sheet:grid-cols-[minmax(190px,1.5fr)_minmax(120px,.9fr)_minmax(150px,1fr)_110px_20px] sheet:gap-4 sheet:px-5 wide:grid-cols-[minmax(210px,1.5fr)_minmax(130px,1fr)_minmax(120px,.9fr)_minmax(150px,1fr)_64px_110px_20px]",
                  w.tone === "late" && "bg-state-error-soft/30",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ServiceIcon service={d.service} />
                  <div className="min-w-0">
                    <b className="block font-bold">{d.ref}</b>
                    <span className="block truncate text-[13px] text-text-secondary">
                      {SERVICE_LABELS[d.service]}
                      {d.summary ? ` · ${d.summary}` : ""}
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
        “Waiting” is time since the last status change. Deals move only when
        your team moves them.
      </p>
    </>
  );
}
