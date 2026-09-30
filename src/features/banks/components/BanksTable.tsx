"use client";

import { Landmark, Trash2 } from "lucide-react";

import { BankMark } from "@/components/bank-mark";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/status-chip";
import { CellLabel } from "@/components/table-cells";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BankListItem } from "@/features/banks/queries";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type BanksTableProps = {
  banks: BankListItem[];
  onAdd?: () => void;
  onEdit?: (bank: BankListItem) => void;
  onToggleStatus?: (bank: BankListItem) => void;
  onDelete?: (bank: BankListItem) => void;
  busyId?: string | null; // a status change is running for this bank
};

// banks.html: grid rows from 760px up (the header row is visual; each
// cell carries its own label for screen readers); below that each row is a card
// (name and actions on top, rate and history labelled below, status right).
const ROW = cn(
  "grid items-start gap-x-3.5 gap-y-3 border-b border-border-subtle bg-bg-surface px-4 py-3.5 last:border-b-0",
  "grid-cols-[1fr_1fr_auto] [grid-template-areas:'main_main_act'_'a_b_st']",
  "sheet:items-center sheet:gap-4 sheet:px-5 sheet:py-[13px]",
  "sheet:grid-cols-[minmax(200px,1.6fr)_.9fr_1fr_1fr_190px] sheet:[grid-template-areas:'main_st_a_b_act']",
);

export function BanksTable({
  banks,
  onAdd,
  onEdit,
  onToggleStatus,
  onDelete,
  busyId,
}: BanksTableProps) {
  if (banks.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No banks yet"
        description="Add a bank to start adding POF rates."
        action={
          <Button size="sm" onClick={onAdd}>
            Add bank
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
          "hidden bg-bg-subtle py-2.5 text-[12.5px] font-semibold text-text-muted sheet:grid sheet:py-2.5",
          "border-b-border-default",
        )}
      >
        <span className="[grid-area:main]">Bank</span>
        <span className="[grid-area:st]">Status</span>
        <span className="[grid-area:a]">Current POF rate</span>
        <span className="[grid-area:b]">Rate history</span>
        <span className="[grid-area:act]" />
      </div>

      <ul>
        {banks.map((bank) => {
          const inactive = bank.status !== "ACTIVE";
          const hasHistory = bank.rateCount > 0;
          return (
            <li key={bank.id} className={ROW}>
              <div
                className={cn(
                  "flex min-w-0 items-center gap-3 [grid-area:main]",
                  inactive && "opacity-50",
                )}
              >
                <BankMark
                  name={bank.name}
                  slug={bank.slug}
                  logoUrl={bank.logoUrl}
                  size={44}
                />
                <div className="min-w-0">
                  <b className="block leading-tight font-bold">{bank.name}</b>
                  <span className="block truncate text-[13px] text-text-secondary">
                    Short name: {bank.shortName ?? "—"}
                  </span>
                </div>
              </div>

              <div className="self-end justify-self-end [grid-area:st] sheet:self-auto sheet:justify-self-auto">
                <StatusChip status={bank.status} />
              </div>

              <div className="tabular-nums [grid-area:a]">
                <CellLabel>POF rate</CellLabel>
                {bank.currentRate ? (
                  <>
                    <b className="font-bold">
                      {formatPercent(bank.currentRate.rate)}
                    </b>
                    {bank.currentRate.note && (
                      <span className="text-[13px] text-text-muted">
                        {" "}
                        {bank.currentRate.note}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-text-muted">No rate</span>
                )}
              </div>

              <div className="text-text-secondary [grid-area:b]">
                <CellLabel>History</CellLabel>
                {bank.rateCount} {bank.rateCount === 1 ? "record" : "records"}
              </div>

              <div className="flex justify-end gap-1 [grid-area:act]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(bank)}
                >
                  Edit
                </Button>
                {/* The design hides Deactivate on phones; status is in the drawer. */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="hidden sheet:inline-flex"
                  disabled={busyId === bank.id}
                  onClick={() => onToggleStatus?.(bank)}
                >
                  {bank.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
                {hasHistory ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Disabled buttons get no pointer events, so the span carries the tooltip. */}
                      <span
                        tabIndex={0}
                        className="inline-flex rounded-control"
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled
                          aria-label={`Delete ${bank.name}`}
                        >
                          <Trash2 strokeWidth={1.9} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Has rate history. Deactivate instead.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${bank.name}`}
                    title="Delete bank"
                    onClick={() => onDelete?.(bank)}
                  >
                    <Trash2 strokeWidth={1.9} />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
