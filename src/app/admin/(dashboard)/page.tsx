import { BellRing, ChevronRight, Inbox, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { getBoardDetail } from "@/features/boards/queries";
import { DashboardView } from "@/features/dashboard/components/DashboardView";
import { getDashboard } from "@/features/dashboard/queries";
import { countPayoutsDue } from "@/features/crypto-deposits/admin-queries";
import { countDealsNeedingAction } from "@/features/deals/queries";
import { formatLongDate } from "@/lib/format";
import { getViewer, requireMember } from "@/lib/server/auth";

// Regenerating from the board detail runs in this page's function.
export const maxDuration = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const searchSchema = z.object({
  board: z.preprocess(first, z.string().max(64).optional().catch(undefined)),
});

export default async function DashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const { organizationId } = await requireMember();
  const { board } = searchSchema.parse(await searchParams);
  const now = new Date();
  const [data, viewer, detail, dealsNeedingAction, payoutsDue] =
    await Promise.all([
      getDashboard(organizationId, now),
      getViewer().catch(() => null),
      board ? getBoardDetail(organizationId, board, now) : null,
      countDealsNeedingAction(organizationId, now),
      countPayoutsDue(organizationId),
    ]);

  return (
    <>
      <PageHeader
        title={viewer ? `Good day, ${viewer.firstName}` : "Good day"}
        description={`${formatLongDate(now, data.timeZone)}. Update a rate, then generate today’s boards.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/forex">
                <Pencil strokeWidth={1.9} />
                Update rates
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/generator">
                <Sparkles strokeWidth={1.9} />
                Generate board
              </Link>
            </Button>
          </>
        }
      />
      {/* Crypto payouts due come first: they run against a timer. */}
      {payoutsDue > 0 && (
        <Link
          href="/admin/deals"
          className="mb-2.5 flex items-center gap-2.5 rounded-control bg-state-error-soft px-3.5 py-3 text-[14px] font-semibold text-state-error"
        >
          <BellRing
            aria-hidden="true"
            className="size-[18px] shrink-0"
            strokeWidth={1.9}
          />
          Payout due: {payoutsDue} crypto deal{payoutsDue > 1 ? "s" : ""}{" "}
          waiting to be paid out
          <span className="ml-auto inline-flex items-center gap-1">
            Pay out
            <ChevronRight
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.9}
            />
          </span>
        </Link>
      )}
      {/* Deal desk: new deals and received payments waiting on the team. */}
      <Link
        href={dealsNeedingAction ? "/admin/deals?filter=needs" : "/admin/deals"}
        className={
          dealsNeedingAction
            ? "mb-5 flex items-center gap-2.5 rounded-control bg-accent-gold-soft px-3.5 py-3 text-[14px] font-semibold text-accent-gold-text"
            : "mb-5 flex items-center gap-2.5 rounded-control border border-border-default bg-bg-surface px-3.5 py-3 text-[14px] text-text-secondary"
        }
      >
        <Inbox
          aria-hidden="true"
          className="size-[18px] shrink-0"
          strokeWidth={1.9}
        />
        {dealsNeedingAction
          ? `${dealsNeedingAction} deal${dealsNeedingAction > 1 ? "s" : ""} need${dealsNeedingAction > 1 ? "" : "s"} action`
          : "No deals need action"}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold">
          {dealsNeedingAction ? "Open the queue" : "All deals"}
          <ChevronRight
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.9}
          />
        </span>
      </Link>
      <DashboardView
        data={data}
        detail={detail}
        boardMissing={board !== undefined && detail === null}
      />
    </>
  );
}
