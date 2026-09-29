"use client";

import { ArrowLeftRight, GripVertical } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { CurrencyFlag } from "@/components/currency-flag";
import { EmptyState } from "@/components/empty-state";
import { RateDelta } from "@/components/rate-delta";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CurrencyListItem } from "@/features/currencies/queries";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { subtractDecimalStrings } from "@/lib/decimal";
import { formatRate, formatUpdatedAt } from "@/lib/format";
import { cn } from "@/lib/utils";

type ForexTableProps = {
  currencies: CurrencyListItem[];
  timeZone: string;
  now: string; // ISO, from the server render, so "Today" is stable
  onAdd?: () => void;
  onEdit?: (currency: CurrencyListItem) => void;
  onToggleStatus?: (currency: CurrencyListItem, active: boolean) => void;
};

// forex.html: all columns from 1100px; Spread hidden from 760px; below
// 760px each row is a card (currency and Edit on top, the two rates
// labelled below, the switch on the right).
const ROW = cn(
  "grid items-start gap-x-3.5 gap-y-3 border-b border-border-subtle bg-bg-surface px-4 py-3.5 last:border-b-0",
  "grid-cols-[1fr_1fr_auto] [grid-template-areas:'main_main_act'_'a_b_st']",
  "sheet:items-center sheet:gap-4 sheet:px-5 sheet:py-[13px]",
  "sheet:grid-cols-[18px_minmax(150px,1.5fr)_.9fr_.9fr_1fr_1fr_64px] sheet:[grid-template-areas:'grip_main_a_b_upd_st_act']",
  "min-[1100px]:grid-cols-[18px_minmax(170px,1.5fr)_.9fr_.9fr_.7fr_1fr_1fr_64px] min-[1100px]:[grid-template-areas:'grip_main_a_b_sp_upd_st_act']",
);

function CellLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-px block text-[11.5px] font-semibold text-text-muted sheet:sr-only">
      {children}
    </span>
  );
}

// Taps on the card open the drawer on phones, but not taps on its controls.
function isControl(event: MouseEvent) {
  return Boolean(
    (event.target as HTMLElement).closest(
      "button, a, input, label, [role=switch]",
    ),
  );
}

export function ForexTable({
  currencies,
  timeZone,
  now,
  onAdd,
  onEdit,
  onToggleStatus,
}: ForexTableProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const nowDate = new Date(now);

  if (currencies.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No currencies yet"
        description="Add a currency and its first rate to start making forex boards."
        action={
          <Button size="sm" onClick={onAdd}>
            Add currency
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
        <span className="[grid-area:main]">Currency</span>
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
        {currencies.map((currency) => {
          const inactive = currency.status !== "ACTIVE";
          const [current, previous] = currency.rates;
          return (
            <li
              key={currency.id}
              className={cn(ROW, isPhone && "cursor-pointer")}
              onClick={(event) => {
                if (isPhone && !isControl(event)) onEdit?.(currency);
              }}
            >
              <span
                aria-hidden="true"
                className="hidden text-grip [grid-area:grip] sheet:flex"
              >
                <GripVertical className="size-4" strokeWidth={1.9} />
              </span>

              <div
                className={cn(
                  "flex min-w-0 items-center gap-3 [grid-area:main]",
                  inactive && "opacity-50",
                )}
              >
                <CurrencyFlag
                  flagCode={currency.flagCode}
                  currencyCode={currency.code}
                />
                <div className="min-w-0">
                  <b className="block leading-tight font-bold">
                    {currency.code}
                  </b>
                  <span className="block truncate text-[13px] text-text-secondary">
                    {currency.name}
                  </span>
                </div>
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
                  onCheckedChange={(checked) =>
                    onToggleStatus?.(currency, checked)
                  }
                  aria-label={`${currency.code} active`}
                />
                <span className="hidden text-[13.5px] font-medium text-text-secondary sheet:inline">
                  {inactive ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="flex justify-end [grid-area:act]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(currency)}
                  aria-label={`Edit ${currency.code} rate`}
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
