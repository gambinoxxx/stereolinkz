"use client";

import { Download, Eye, History, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { BoardFrame } from "@/components/board/BoardFrame";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadMoreBoards } from "@/features/boards/actions";
import {
  type BoardListItem,
  groupBoardsByDay,
  type HistoryType,
  ratePills,
  templateName,
  TYPE_LABEL,
} from "@/features/boards/history";
import { isTemplateKey } from "@/features/templates/registry";
import { formatBoardTime, formatLongDate } from "@/lib/format";

type HistoryListProps = {
  type: HistoryType;
  count: number;
  initial: { boards: BoardListItem[]; nextCursor: string | null };
  timezone: string;
  now: string; // the server's time, for "Today"
  onView: (board: BoardListItem) => void;
  onRegenerate: (board: BoardListItem) => void;
};

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "FOREX", label: "Forex" },
  { value: "POF", label: "POF" },
  { value: "CRYPTO", label: "Crypto" },
] as const;

// history.html: the filter and count, then boards grouped by day in the
// org's zone. Rows show what the snapshot holds, never today's rates.
export function HistoryList({
  type,
  count,
  initial,
  timezone,
  now,
  onView,
  onRegenerate,
}: HistoryListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [boards, setBoards] = useState(initial.boards);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loading, startLoading] = useTransition();

  // Grouped after merging pages, so a day split across pages has one heading.
  const groups = useMemo(
    () => groupBoardsByDay(boards, new Date(now), timezone),
    [boards, now, timezone],
  );

  function loadMore() {
    if (loading || !nextCursor) return;
    startLoading(async () => {
      const result = await loadMoreBoards(type, nextCursor);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBoards((current) => {
        const seen = new Set(current.map((b) => b.id));
        return [
          ...current,
          ...result.data.boards.filter((b) => !seen.has(b.id)),
        ];
      });
      setNextCursor(result.data.nextCursor);
    });
  }

  const noun = count === 1 ? "board" : "boards";

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="segmented"
          value={type ?? "ALL"}
          onValueChange={(next) => {
            if (!next) return;
            router.replace(
              next === "ALL" ? pathname : `${pathname}?type=${next}`,
              { scroll: false },
            );
          }}
          aria-label="Filter by board type"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value}>
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-[13.5px] text-text-muted">
          {count} {noun}
        </span>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={History}
          title={
            type
              ? `No ${FILTERS.find((f) => f.value === type)?.label} boards yet`
              : "No boards yet"
          }
          description="Boards you generate are saved here with the rates they showed."
          action={
            <Button asChild size="sm">
              <Link href="/admin/generator">Open the generator</Link>
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.heading}>
            <h2 className="mt-[26px] mb-2.5 flex items-center gap-2.5 text-[13.5px] font-bold text-text-secondary after:h-px after:flex-1 after:bg-border-default">
              {group.heading}
            </h2>
            <div className="rounded-panel border border-border-default bg-bg-surface">
              {group.boards.map((board) => (
                <HistoryRow
                  key={board.id}
                  board={board}
                  timezone={timezone}
                  onView={onView}
                  onRegenerate={onRegenerate}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {nextCursor && (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 aria-hidden="true" className="animate-spin" />}
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}

function HistoryRow({
  board,
  timezone,
  onView,
  onRegenerate,
}: {
  board: BoardListItem;
  timezone: string;
  onView: (board: BoardListItem) => void;
  onRegenerate: (board: BoardListItem) => void;
}) {
  const { snapshot } = board;
  const download = board.latestImageId
    ? `/api/boards/${board.id}/download`
    : null;
  const row =
    "grid grid-cols-[54px_minmax(0,1fr)] items-center gap-3.5 border-b border-border-subtle p-3.5 last:border-b-0 sheet:grid-cols-[62px_minmax(0,1fr)_auto] sheet:gap-[18px] sheet:px-[18px]";
  const actions =
    "col-span-full flex gap-2 *:flex-1 sheet:col-span-1 sheet:*:flex-none";

  const downloadButton = (
    <Button
      asChild={!!download}
      size="sm"
      variant="outline"
      disabled={!download}
    >
      {download ? (
        <a href={download} download>
          <Download aria-hidden="true" strokeWidth={1.9} />
          Download
        </a>
      ) : (
        <span>
          <Download aria-hidden="true" strokeWidth={1.9} />
          Download
        </span>
      )}
    </Button>
  );

  // A snapshot that fails to parse is never rendered (Invariant 4).
  if (!snapshot) {
    const at = new Date(board.createdAt);
    return (
      <div className={row}>
        <div
          aria-hidden="true"
          className="aspect-[9/16] rounded-[7px] bg-bg-subtle ring-1 ring-border-default"
        />
        <div className="min-w-0">
          <b className="text-[15.5px]">This board can’t be displayed</b>
          <p className="mt-1 text-[13px] text-text-muted">
            {formatLongDate(at, timezone)}, {formatBoardTime(at, timezone)}
          </p>
        </div>
        <div className={actions}>
          <Button size="sm" variant="outline" disabled>
            <Eye aria-hidden="true" strokeWidth={1.9} />
            View
          </Button>
          {downloadButton}
          <Button size="sm" variant="outline" disabled>
            <RefreshCw aria-hidden="true" strokeWidth={1.9} />
            Regenerate
          </Button>
        </div>
      </div>
    );
  }

  const label = TYPE_LABEL[board.type];
  return (
    <div className={row}>
      <button
        type="button"
        onClick={() => onView(board)}
        aria-label={`View ${label.toLowerCase()} from ${snapshot.content.timeLabel}`}
        className="block w-full cursor-pointer overflow-hidden rounded-[7px] ring-1 ring-border-default focus-visible:outline-2 focus-visible:outline-accent-primary"
      >
        {isTemplateKey(board.templateKey) ? (
          <BoardFrame
            templateKey={board.templateKey}
            snapshot={snapshot}
            label={`${label} preview`}
            className="rounded-none"
          />
        ) : (
          <div className="aspect-[9/16] bg-bg-subtle" />
        )}
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <b className="text-[15.5px]">{label}</b>
          <span className="text-text-muted">{snapshot.content.timeLabel}</span>
          <span className="inline-flex h-6 items-center rounded-full bg-border-subtle px-[9px] text-[12.5px] font-semibold whitespace-nowrap text-text-secondary">
            {templateName(board.templateKey)}
          </span>
        </div>
        <ul
          className="mt-2 flex flex-wrap gap-1.5"
          aria-label="Rates on this board"
        >
          {ratePills(snapshot).map((pill, i) => (
            <li
              key={i}
              className="rounded-[7px] border border-border-subtle bg-bg-subtle px-2 py-0.5 text-[13px] whitespace-nowrap tabular-nums"
            >
              <b className="font-bold">{pill.label}</b> {pill.value}
            </li>
          ))}
        </ul>
      </div>
      <div className={actions}>
        <Button size="sm" variant="outline" onClick={() => onView(board)}>
          <Eye aria-hidden="true" strokeWidth={1.9} />
          View
        </Button>
        {downloadButton}
        <Button size="sm" variant="outline" onClick={() => onRegenerate(board)}>
          <RefreshCw aria-hidden="true" strokeWidth={1.9} />
          Regenerate
        </Button>
      </div>
    </div>
  );
}
