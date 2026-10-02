"use client";

import { ArrowDown, ArrowUp, Coins, GripVertical } from "lucide-react";
import { useState } from "react";

import { CoinBadge } from "@/components/coin-badge";
import { EmptyState } from "@/components/empty-state";
import { RateDelta } from "@/components/rate-delta";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CellLabel, isRowControl } from "@/components/table-cells";
import { dropOrder, moveItem } from "@/lib/order";
import type { CoinListItem } from "@/features/coins/queries";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { subtractDecimalStrings } from "@/lib/decimal";
import { formatRate, formatUpdatedAt } from "@/lib/format";
import { cn } from "@/lib/utils";

type CryptoTableProps = {
  coins: CoinListItem[];
  timeZone: string;
  now: string; // ISO, from the server render, so "Today" is stable
  onAdd?: () => void;
  onEdit?: (coin: CoinListItem) => void;
  onToggleStatus?: (coin: CoinListItem, active: boolean) => void;
  // Only with the full list (filter All), so a partial order is never saved.
  reorderable?: boolean;
  onReorder?: (orderedIds: string[]) => void;
};

type DropTarget = { id: string; side: "before" | "after" } | null;

// crypto.html: all columns from 1100px; Networks and Spread hidden from
// 760px; below 760px each row is a card (coin and Edit on top, the two
// rates labelled below, the switch on the right).
const ROW = cn(
  "grid items-start gap-x-3.5 gap-y-3 border-b border-border-subtle bg-bg-surface px-4 py-3.5 last:border-b-0",
  "grid-cols-[1fr_1fr_auto] [grid-template-areas:'main_main_act'_'a_b_st']",
  "sheet:items-center sheet:gap-4 sheet:px-5 sheet:py-[13px]",
  "sheet:grid-cols-[18px_minmax(150px,1.5fr)_.9fr_.9fr_1fr_1fr_minmax(64px,auto)] sheet:[grid-template-areas:'grip_main_a_b_upd_st_act']",
  "min-[1100px]:grid-cols-[18px_minmax(150px,1.3fr)_minmax(120px,1fr)_.8fr_.8fr_.6fr_1fr_1fr_minmax(64px,auto)] min-[1100px]:[grid-template-areas:'grip_main_net_a_b_sp_upd_st_act']",
);

export function CryptoTable({
  coins,
  timeZone,
  now,
  onAdd,
  onEdit,
  onToggleStatus,
  reorderable = false,
  onReorder,
}: CryptoTableProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const nowDate = new Date(now);
  // Native HTML5 drag, started only from the grip (armed on pointer down).
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const ids = coins.map((c) => c.id);

  function endDrag() {
    setArmedId(null);
    setDraggingId(null);
    setDropTarget(null);
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= ids.length) return; // at the end: nothing to do
    onReorder?.(moveItem(ids, index, to));
  }

  if (coins.length === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="Add your first coin"
        description="Add a coin and its first rate to start making crypto boards."
        action={
          <Button size="sm" onClick={onAdd}>
            Add coin
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
      <div
        aria-hidden="true"
        className={cn(
          ROW,
          "hidden border-b-border-default bg-bg-subtle py-2.5 text-[12.5px] font-semibold text-text-muted sheet:grid sheet:py-2.5",
        )}
      >
        <span className="[grid-area:grip]" />
        <span className="[grid-area:main]">Coin</span>
        <span className="hidden [grid-area:net] min-[1100px]:block">
          Networks
        </span>
        <span className="text-right [grid-area:a]">We buy</span>
        <span className="text-right [grid-area:b]">We sell</span>
        <span className="hidden text-right [grid-area:sp] min-[1100px]:block">
          Spread
        </span>
        <span className="[grid-area:upd]">Updated</span>
        <span className="[grid-area:st]">Status</span>
        <span className="[grid-area:act]" />
      </div>

      <ul>
        {coins.map((coin, index) => {
          const inactive = coin.status !== "ACTIVE";
          const [current, previous] = coin.rates;
          const dropSide = dropTarget?.id === coin.id ? dropTarget.side : null;
          return (
            <li
              key={coin.id}
              draggable={reorderable && armedId === coin.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", coin.id);
                setDraggingId(coin.id);
              }}
              onDragOver={(event) => {
                if (!draggingId) return;
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                const side =
                  event.clientY < box.top + box.height / 2 ? "before" : "after";
                if (dropSide !== side) setDropTarget({ id: coin.id, side });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingId && dropTarget) {
                  const next = dropOrder(
                    ids,
                    draggingId,
                    dropTarget.id,
                    dropTarget.side,
                  );
                  if (next.join() !== ids.join()) onReorder?.(next);
                }
                endDrag();
              }}
              onDragEnd={endDrag}
              className={cn(
                ROW,
                isPhone && "cursor-pointer",
                draggingId === coin.id && "opacity-40",
                // forex.html .drop-above: a 3px violet line where it will land
                dropSide === "before" &&
                  "shadow-[inset_0_3px_0_var(--accent-primary)]",
                dropSide === "after" &&
                  "shadow-[inset_0_-3px_0_var(--accent-primary)]",
              )}
              onClick={(event) => {
                if (isPhone && !isRowControl(event)) onEdit?.(coin);
              }}
            >
              {reorderable ? (
                <span
                  aria-hidden="true"
                  title="Drag to reorder"
                  onPointerDown={() => setArmedId(coin.id)}
                  onPointerUp={() => setArmedId(null)}
                  className="hidden cursor-grab text-grip [grid-area:grip] active:cursor-grabbing sheet:flex"
                >
                  <GripVertical className="size-4" strokeWidth={1.9} />
                </span>
              ) : (
                <span className="hidden [grid-area:grip] sheet:block" />
              )}

              <div
                className={cn(
                  "flex min-w-0 items-center gap-3 [grid-area:main]",
                  inactive && "opacity-50",
                )}
              >
                <CoinBadge
                  ticker={coin.ticker}
                  name={coin.name}
                  iconUrl={coin.iconUrl}
                  badgeColor={coin.badgeColor}
                />
                <div className="min-w-0">
                  <b className="block leading-tight font-bold">{coin.ticker}</b>
                  <span className="block truncate text-[13px] text-text-secondary">
                    {coin.name}
                  </span>
                </div>
              </div>

              <div className="hidden min-w-0 flex-wrap gap-1 [grid-area:net] min-[1100px]:flex">
                {coin.networks.map((network) => (
                  <span
                    key={network}
                    className="rounded-md bg-border-subtle px-2 py-0.5 text-[12.5px] font-semibold whitespace-nowrap text-text-secondary"
                  >
                    {network}
                  </span>
                ))}
              </div>

              <div
                className={cn(
                  "tabular-nums [grid-area:a] sheet:text-right",
                  inactive && "opacity-50",
                )}
              >
                <CellLabel>We buy</CellLabel>
                <span className="text-[16.5px] font-bold">
                  {current ? formatRate(current.buy) : "—"}
                </span>
                {!current && (
                  <span className="block text-[12.5px] text-text-muted">
                    No rate yet
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "tabular-nums [grid-area:b] sheet:text-right",
                  inactive && "opacity-50",
                )}
              >
                <CellLabel>We sell</CellLabel>
                <span className="text-[16.5px] font-bold">
                  {current ? formatRate(current.sell) : "—"}
                </span>
                {current && previous && (
                  <span className="block">
                    <RateDelta
                      current={current.sell}
                      previous={previous.sell}
                      kind="amount"
                    />
                  </span>
                )}
              </div>

              <div className="hidden text-right text-text-secondary tabular-nums [grid-area:sp] min-[1100px]:block">
                {current
                  ? formatRate(
                      subtractDecimalStrings(current.sell, current.buy),
                    )
                  : "—"}
              </div>

              <div className="hidden text-[14px] text-text-secondary [grid-area:upd] sheet:block">
                {current
                  ? formatUpdatedAt(
                      new Date(current.createdAt),
                      nowDate,
                      timeZone,
                    )
                  : "—"}
              </div>

              <div className="flex items-center gap-2.5 self-end justify-self-end [grid-area:st] sheet:self-auto sheet:justify-self-auto">
                <Switch
                  checked={!inactive}
                  onCheckedChange={(checked) => onToggleStatus?.(coin, checked)}
                  aria-label={`${coin.ticker} active`}
                />
                <span className="hidden text-[13.5px] font-medium text-text-secondary sheet:inline">
                  {inactive ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-1 [grid-area:act]">
                {reorderable && (
                  // Up/down: always on touch screens; for mouse users they
                  // stay hidden until focused, so the keyboard can reorder.
                  // aria-disabled (not disabled) keeps focus at the ends.
                  <>
                    {(
                      [
                        [-1, "up", ArrowUp],
                        [1, "down", ArrowDown],
                      ] as const
                    ).map(([by, word, Icon]) => {
                      const atEnd =
                        by === -1 ? index === 0 : index === ids.length - 1;
                      return (
                        <Button
                          key={word}
                          size="icon"
                          variant="ghost"
                          aria-label={`Move ${coin.ticker} ${word}`}
                          aria-disabled={atEnd || undefined}
                          onClick={() => move(index, by)}
                          className="aria-disabled:opacity-40 pointer-fine:sr-only pointer-fine:focus-visible:not-sr-only"
                        >
                          <Icon strokeWidth={1.9} />
                        </Button>
                      );
                    })}
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(coin)}
                  aria-label={`Edit ${coin.ticker} rate`}
                >
                  Edit
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
