"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  History,
  Info,
  Landmark,
  Pencil,
  Percent,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { BankMark } from "@/components/bank-mark";
import { BoardFrame } from "@/components/board/BoardFrame";
import { CurrencyFlag } from "@/components/currency-flag";
import { EmptyState } from "@/components/empty-state";
import { RateDelta } from "@/components/rate-delta";
import { Button } from "@/components/ui/button";
import { BoardDetailDialog } from "@/features/boards/components/BoardDetailDialog";
import { RegenerateDialog } from "@/features/boards/components/RegenerateDialog";
import { type BoardListItem, TYPE_LABEL } from "@/features/boards/history";
import type { BoardDetail } from "@/features/boards/queries";
import type { CurrencyListItem } from "@/features/currencies/queries";
import type { RateChange } from "@/features/dashboard/changes";
import type { DashboardData } from "@/features/dashboard/queries";
import { ForexRateDrawer } from "@/features/forex-rates/components/ForexRateDrawer";
import {
  type PofDrawerState,
  PofRateDrawer,
} from "@/features/pof-rates/components/PofRateDrawer";
import { isTemplateKey } from "@/features/templates/registry";
import {
  formatBoardDay,
  formatBoardTime,
  formatPercent,
  formatRate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type DashboardViewProps = {
  data: DashboardData;
  detail: BoardDetail | null; // ?board=<id>, loaded on the server
  boardMissing: boolean;
};

function Panel({
  title,
  link,
  footer,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-panel border border-border-default bg-bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-[15px]">
        <h2 className="text-base font-bold tracking-[-0.1px]">{title}</h2>
        {link && (
          <Link
            href={link.href}
            className="text-[14px] font-semibold text-accent-primary hover:underline"
          >
            {link.label}
          </Link>
        )}
      </div>
      {children}
      {footer && (
        <div className="flex items-center gap-2 border-t border-border-subtle px-5 py-3 text-[13.5px] text-text-muted">
          {footer}
        </div>
      )}
    </section>
  );
}

const row =
  "flex items-center gap-3 border-b border-border-subtle px-5 py-3 last:border-b-0";

// dashboard.html: the overview and the fastest path to "update a rate,
// then generate". Pencils open the same drawers as the rate pages; a save
// revalidates /admin, so the panels, stats and changes refresh in place.
export function DashboardView({
  data,
  detail,
  boardMissing,
}: DashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingForex, setEditingForex] = useState<CurrencyListItem | null>(
    null,
  );
  const [pofDrawer, setPofDrawer] = useState<PofDrawerState | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<BoardListItem | null>(null);
  const { stats, timeZone } = data;
  const now = new Date(data.now);

  function setBoardParam(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("board", id);
    else params.delete("board");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (!boardMissing) return;
    toast.error("That board couldn't be found.");
    router.replace(pathname, { scroll: false });
  }, [boardMissing, pathname, router]);

  // The drawer reads its currency from the latest data after a save.
  const editing = editingForex
    ? (data.forex.find((c) => c.id === editingForex.id) ?? editingForex)
    : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 rounded-panel border border-border-default bg-bg-surface shell:grid-cols-4">
        <Stat
          label="Active currencies"
          value={stats.currencies.active}
          of={stats.currencies.total}
        />
        <Stat
          label="Active POF banks"
          value={stats.banks.active}
          of={stats.banks.total}
        />
        <Stat
          label="Boards today"
          value={stats.boardsToday.count}
          sub={
            stats.boardsToday.lastAt
              ? `Last at ${formatBoardTime(new Date(stats.boardsToday.lastAt), timeZone)}`
              : "—"
          }
        />
        <Stat
          label="Last rate change"
          value={
            stats.lastChange
              ? changeWhen(stats.lastChange.at, now, timeZone)
              : "—"
          }
          sub={stats.lastChange?.label ?? "—"}
        />
      </div>

      <div className="mb-6 grid gap-6 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          title="Today’s forex"
          link={{ href: "/admin/forex", label: "All currencies" }}
        >
          {data.forex.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Add your first currency"
              description="Currencies and their buy and sell rates appear here."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/forex">Add a currency</Link>
                </Button>
              }
              className="m-4 min-h-48"
            />
          ) : (
            data.forex.map((currency) => {
              const [current, previous] = currency.rates;
              return (
                <div key={currency.id} className={row}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CurrencyFlag
                      flagCode={currency.flagCode}
                      currencyCode={currency.code}
                    />
                    <div className="min-w-0">
                      <b className="block leading-[1.2] font-bold">
                        {currency.code}
                      </b>
                      <span className="block truncate text-[13px] text-text-secondary">
                        {currency.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {current ? (
                      <>
                        <div className="text-[16.5px] font-bold tabular-nums">
                          {formatRate(current.buy)}{" "}
                          <span className="text-text-muted">/</span>{" "}
                          {formatRate(current.sell)}
                        </div>
                        <RateDelta
                          current={current.sell}
                          previous={previous?.sell ?? null}
                          kind="amount"
                        />
                      </>
                    ) : (
                      <span className="text-[13.5px] text-text-muted">
                        No rate yet
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${currency.code} rate`}
                    onClick={() => setEditingForex(currency)}
                  >
                    <Pencil strokeWidth={1.9} />
                  </Button>
                </div>
              );
            })
          )}
        </Panel>

        <Panel
          title="Today’s POF"
          link={{ href: "/admin/pof", label: "All banks" }}
        >
          {data.pof.length === 0 ? (
            <EmptyState
              icon={Percent}
              title="Add a POF rate"
              description="Banks shown on POF boards appear here with their rate."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/pof">Add a POF rate</Link>
                </Button>
              }
              className="m-4 min-h-48"
            />
          ) : (
            data.pof.map((bank) => {
              const [current, previous] = bank.rates;
              const label = bank.shortName ?? bank.name;
              return (
                <div key={bank.id} className={row}>
                  <BankMark
                    name={bank.name}
                    slug={bank.slug}
                    logoUrl={bank.logoUrl}
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <b className="font-bold">{label}</b>
                    {current?.note && (
                      <span className="ml-1.5 inline-flex h-6 items-center rounded-full bg-accent-gold-soft px-[9px] text-[12.5px] font-semibold whitespace-nowrap text-accent-gold-text">
                        {current.note}
                      </span>
                    )}
                  </div>
                  {current && (
                    <div className="text-right">
                      <div className="text-[16.5px] font-bold tabular-nums">
                        {formatPercent(current.rate)}
                      </div>
                      <RateDelta
                        current={current.rate}
                        previous={previous?.rate ?? null}
                        kind="points"
                      />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${label} rate`}
                    onClick={() => setPofDrawer({ mode: "edit", bank })}
                  >
                    <Pencil strokeWidth={1.9} />
                  </Button>
                </div>
              );
            })
          )}
        </Panel>
      </div>

      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          title="Recent boards"
          link={{ href: "/admin/history", label: "History" }}
        >
          {data.boards.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No boards yet"
              description="Generate a board and it will show here."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/generator">Open the generator</Link>
                </Button>
              }
              className="m-4 min-h-48"
            />
          ) : (
            <div className="grid grid-cols-3 gap-2.5 p-3.5 sheet:gap-4 sheet:px-5 sheet:py-[18px]">
              {data.boards.map((board) => (
                <RecentBoard
                  key={board.id}
                  board={board}
                  timeZone={timeZone}
                  now={now}
                  onOpen={() => {
                    setDismissed(null);
                    setBoardParam(board.id);
                  }}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent rate changes"
          footer={
            <>
              <Info
                aria-hidden="true"
                className="size-4 shrink-0"
                strokeWidth={1.9}
              />
              Every change is kept in rate history. Old boards never change.
            </>
          }
        >
          {data.changes.length === 0 ? (
            <EmptyState
              icon={History}
              title="Rate changes will appear here"
              description="Each saved rate is listed with the value it replaced."
              className="m-4 min-h-48"
            />
          ) : (
            data.changes.map((change) => (
              <ChangeRow
                key={change.id}
                change={change}
                timeZone={timeZone}
                now={now}
              />
            ))
          )}
        </Panel>
      </div>

      <ForexRateDrawer
        currency={editing}
        onOpenChange={(open) => !open && setEditingForex(null)}
        timeZone={timeZone}
        now={data.now}
      />
      <PofRateDrawer
        state={pofDrawer}
        onOpenChange={(open) => !open && setPofDrawer(null)}
        bankOptions={data.bankOptions}
        timeZone={timeZone}
        now={data.now}
      />
      <BoardDetailDialog
        board={detail && detail.id !== dismissed ? detail : null}
        onClose={() => {
          if (detail) setDismissed(detail.id);
          setBoardParam(null);
        }}
        onRegenerate={setRegenerating}
      />
      <RegenerateDialog
        board={regenerating}
        onClose={() => setRegenerating(null)}
      />
    </>
  );
}

// "10:25 AM" for today in the org zone, otherwise "Wed 30 Sept".
function changeWhen(at: string, now: Date, timeZone: string): string {
  const date = new Date(at);
  const day = formatBoardDay(date, now, timeZone);
  return day === "Today" ? formatBoardTime(date, timeZone) : day;
}

function Stat({
  label,
  value,
  of,
  sub,
}: {
  label: string;
  value: number | string;
  of?: number;
  sub?: string;
}) {
  return (
    <div className="border-border-subtle px-4 py-3.5 not-first:border-l nth-3:border-l-0 nth-[n+3]:border-t shell:px-[22px] shell:py-[18px] shell:nth-3:border-l shell:nth-[n+3]:border-t-0">
      <div className="text-[13px] font-medium text-text-secondary">{label}</div>
      <div className="mt-0.5 text-[23px] leading-[1.2] font-[750] tracking-[-0.6px] tabular-nums shell:text-[27px]">
        {value}
        {of !== undefined && (
          <small className="text-[15px] font-semibold tracking-normal text-text-muted">
            {" "}
            of {of}
          </small>
        )}
      </div>
      {sub && <div className="mt-0.5 text-[13px] text-text-muted">{sub}</div>}
    </div>
  );
}

function RecentBoard({
  board,
  timeZone,
  now,
  onOpen,
}: {
  board: BoardListItem;
  timeZone: string;
  now: Date;
  onOpen: () => void;
}) {
  const { snapshot } = board;
  const kind = TYPE_LABEL[board.type].replace(" board", "");
  const created = new Date(board.createdAt);
  const day = formatBoardDay(created, now, timeZone);
  const when = `${day === "Today" ? "" : `${day.split(" ")[0]} `}${snapshot?.content.timeLabel ?? formatBoardTime(created, timeZone)}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!snapshot}
      aria-label={`View ${kind} board from ${when}`}
      className="flex min-w-0 cursor-pointer flex-col gap-2 text-left disabled:cursor-default"
    >
      {snapshot && isTemplateKey(board.templateKey) ? (
        <BoardFrame
          templateKey={board.templateKey}
          snapshot={snapshot}
          label={`${kind} board preview`}
          className="ring-1 ring-border-default shadow-[0_8px_20px_rgb(31_11_63/0.12)]"
        />
      ) : (
        <div className="aspect-[9/16] rounded-control bg-bg-subtle ring-1 ring-border-default" />
      )}
      <small className="text-[12.5px] font-medium text-text-secondary">
        <b>{kind}</b>, {when}
      </small>
    </button>
  );
}

function ChangeRow({
  change,
  timeZone,
  now,
}: {
  change: RateChange;
  timeZone: string;
  now: Date;
}) {
  const Icon =
    change.direction === "up"
      ? ArrowUp
      : change.direction === "down"
        ? ArrowDown
        : null;
  return (
    <div className={row}>
      <span className="w-[62px] shrink-0 text-[12.5px] text-text-muted">
        {changeWhen(change.at, now, timeZone)}
      </span>
      <div className="min-w-0 flex-1">
        <b>{change.label}</b>
        <div className="text-[13.5px] text-text-muted tabular-nums">
          {change.from === null ? (
            <>
              New rate{" "}
              <span className="font-semibold text-text-primary">
                {change.to}
              </span>
            </>
          ) : (
            <>
              {change.from}
              <ArrowRight
                aria-label="to"
                className="mx-1 inline size-3.5 align-[-2px]"
                strokeWidth={1.9}
              />
              <span className="font-semibold text-text-primary">
                {change.to}
              </span>
            </>
          )}
        </div>
      </div>
      {Icon && (
        <Icon
          aria-label={change.direction === "up" ? "Up" : "Down"}
          className={cn(
            "size-4 shrink-0",
            change.direction === "up"
              ? "text-state-success"
              : "text-state-error",
          )}
          strokeWidth={2.2}
        />
      )}
    </div>
  );
}
