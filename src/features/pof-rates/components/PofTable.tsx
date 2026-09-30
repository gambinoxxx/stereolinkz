"use client";

import { Percent } from "lucide-react";

import { BankMark } from "@/components/bank-mark";
import { EmptyState } from "@/components/empty-state";
import { RateDelta } from "@/components/rate-delta";
import { CellLabel, isRowControl } from "@/components/table-cells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PofBankItem } from "@/features/pof-rates/queries";
import { isPofShown } from "@/features/pof-rates/visibility";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatPercent, formatUpdatedAt } from "@/lib/format";
import { cn } from "@/lib/utils";

type PofTableProps = {
  banks: PofBankItem[];
  timeZone: string;
  now: string; // ISO, from the server render
  onAdd?: () => void;
  onEdit?: (bank: PofBankItem) => void;
  onTogglePof?: (bank: PofBankItem, active: boolean) => void;
};

// pof.html: grid rows from 760px; below that each row is a card (bank and
// Edit on top, rate and note labelled below, the switch on the right).
const ROW = cn(
  "grid items-start gap-x-3.5 gap-y-3 border-b border-border-subtle bg-bg-surface px-4 py-3.5 last:border-b-0",
  "grid-cols-[1fr_1fr_auto] [grid-template-areas:'main_main_act'_'a_b_st']",
  "sheet:items-center sheet:gap-4 sheet:px-5 sheet:py-[13px]",
  "sheet:grid-cols-[minmax(180px,1.6fr)_.8fr_1.1fr_1fr_1fr_64px] sheet:[grid-template-areas:'main_a_b_upd_st_act']",
);

export function PofTable({
  banks,
  timeZone,
  now,
  onAdd,
  onEdit,
  onTogglePof,
}: PofTableProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const nowDate = new Date(now);

  if (banks.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        title="No POF rates yet"
        description="Give a bank its rate per month to start making POF boards."
        action={
          <Button size="sm" onClick={onAdd}>
            Add a POF rate
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
        <span className="[grid-area:main]">Bank</span>
        <span className="text-right [grid-area:a]">Rate</span>
        <span className="[grid-area:b]">Note</span>
        <span className="[grid-area:upd]">Updated</span>
        <span className="[grid-area:st]">Status</span>
        <span className="[grid-area:act]" />
      </div>

      <ul>
        {banks.map((bank) => {
          const shown = isPofShown(bank);
          const bankInactive = bank.status !== "ACTIVE";
          const [current, previous] = bank.rates;
          const label = bank.shortName ?? bank.name;
          const toggle = (
            <Switch
              checked={shown}
              disabled={bankInactive}
              onCheckedChange={(checked) => onTogglePof?.(bank, checked)}
              aria-label={`${label} rate active`}
            />
          );
          return (
            <li
              key={bank.id}
              className={cn(ROW, isPhone && "cursor-pointer")}
              onClick={(event) => {
                if (isPhone && !isRowControl(event)) onEdit?.(bank);
              }}
            >
              <div
                className={cn(
                  "flex min-w-0 items-center gap-3 [grid-area:main]",
                  !shown && "opacity-50",
                )}
              >
                <BankMark
                  name={bank.name}
                  slug={bank.slug}
                  logoUrl={bank.logoUrl}
                />
                <div className="min-w-0">
                  <b className="block leading-tight font-bold">{bank.name}</b>
                  <span className="block truncate text-[13px] text-text-secondary">
                    {bankInactive ? "Bank is inactive" : `Shown as “${label}”`}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "tabular-nums [grid-area:a] sheet:text-right",
                  !shown && "opacity-50",
                )}
              >
                <CellLabel>Rate</CellLabel>
                <span className="text-[16.5px] font-bold">
                  {current ? formatPercent(current.rate) : "—"}
                </span>
                {current && previous && (
                  <span className="block">
                    <RateDelta
                      current={current.rate}
                      previous={previous.rate}
                      kind="points"
                    />
                  </span>
                )}
              </div>

              <div className={cn("[grid-area:b]", !shown && "opacity-50")}>
                <CellLabel>Note</CellLabel>
                {current?.note ? (
                  <Badge variant="gold">{current.note}</Badge>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
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
                {bankInactive ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A disabled switch gets no pointer events, so the span carries the tooltip. */}
                      <span tabIndex={0} className="inline-flex rounded-full">
                        {toggle}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Activate the bank on the Banks page first
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  toggle
                )}
                <span className="hidden text-[13.5px] font-medium text-text-secondary sheet:inline">
                  {shown ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex justify-end [grid-area:act]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(bank)}
                  aria-label={`Edit ${label} rate`}
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
