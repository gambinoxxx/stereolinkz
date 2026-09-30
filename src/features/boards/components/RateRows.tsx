"use client";

import Link from "next/link";
import {
  type Control,
  Controller,
  type UseFormRegister,
} from "react-hook-form";

import { BankMark } from "@/components/bank-mark";
import { CurrencyFlag } from "@/components/currency-flag";
import { InputAddon } from "@/components/input-addon";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { BoardType } from "@/features/boards/defaults";
import type { RateField } from "@/features/boards/diff";
import type {
  FormRow,
  GeneratorEntities,
  GeneratorFormValues,
} from "@/features/boards/generator-form";
import { NOTE_MAX } from "@/features/pof-rates/schema";
import { cn } from "@/lib/utils";

type RateRowsProps = {
  type: BoardType;
  rows: FormRow[];
  entities: GeneratorEntities;
  control: Control<GeneratorFormValues>;
  register: UseFormRegister<GeneratorFormValues>;
  changed: Map<string, RateField[]>;
  fieldErrors: Record<string, string>;
  maxRows: number;
};

// Column layouts from generator.html .gr (phones first, then ≥ 760px).
const GRID = {
  FOREX:
    "grid-cols-[22px_minmax(0,1fr)_92px_92px] gap-2 sheet:grid-cols-[22px_minmax(0,1fr)_128px_128px] sheet:gap-3",
  POF: "grid-cols-[22px_minmax(0,1fr)_92px] gap-2 sheet:grid-cols-[22px_minmax(0,1fr)_110px_150px] sheet:gap-3",
};

// Step 3: one row per active currency or POF bank. A value that differs
// from the current rate turns gold; ticked rows fill the capacity bar.
export function RateRows({
  type,
  rows,
  entities,
  control,
  register,
  changed,
  fieldErrors,
  maxRows,
}: RateRowsProps) {
  const included = rows.filter((row) => row.included).length;
  const over = included > maxRows;
  const invalid = (id: string, field: RateField) =>
    fieldErrors[`rows.${id}.${field}`] ? true : undefined;
  const gold = (id: string, field: RateField) =>
    changed.get(id)?.includes(field) ?? false;

  if (rows.length === 0)
    return (
      <p className="rounded-control bg-bg-subtle px-4 py-3.5 text-[14px] text-text-secondary">
        {type === "FOREX" ? (
          <>
            No active currencies with a rate yet.{" "}
            <Link
              href="/admin/forex"
              className="font-semibold text-accent-primary"
            >
              Add one on the Forex page
            </Link>
            .
          </>
        ) : (
          <>
            No banks are showing a POF rate yet.{" "}
            <Link
              href="/admin/pof"
              className="font-semibold text-accent-primary"
            >
              Add one on the POF page
            </Link>
            .
          </>
        )}
      </p>
    );

  const currencies = new Map(entities.currencies.map((c) => [c.id, c]));
  const banks = new Map(entities.banks.map((b) => [b.id, b]));

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "grid items-center border-b border-border-subtle pb-2 text-[12.5px] font-semibold text-text-muted",
          GRID[type],
        )}
      >
        <span />
        <span>{type === "FOREX" ? "Currency" : "Bank"}</span>
        {type === "FOREX" ? (
          <>
            <span>We buy</span>
            <span>We sell</span>
          </>
        ) : (
          <>
            <span>Rate</span>
            <span className="hidden sheet:block">Note</span>
          </>
        )}
      </div>

      {rows.map((row, index) => {
        const currency = currencies.get(row.id);
        const bank = banks.get(row.id);
        const label = currency?.code ?? bank?.shortName ?? bank?.name ?? "";
        const off = !row.included;
        return (
          <div
            key={row.id}
            className={cn(
              "grid items-center border-b border-border-subtle py-2 last:border-b-0",
              GRID[type],
            )}
          >
            <Controller
              control={control}
              name={`rows.${index}.included`}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                  aria-label={`Include ${label}`}
                />
              )}
            />

            <div
              className={cn(
                "flex min-w-0 items-center gap-3",
                off && "opacity-45",
              )}
            >
              {currency ? (
                <CurrencyFlag
                  flagCode={currency.flagCode}
                  currencyCode={currency.code}
                  className="max-sheet:size-7!"
                />
              ) : bank ? (
                <BankMark
                  name={bank.name}
                  slug={bank.slug}
                  logoUrl={bank.logoUrl}
                  className="max-sheet:size-7! max-sheet:text-[12px]!"
                />
              ) : null}
              <div className="min-w-0">
                <b className="block leading-[1.2] font-bold">{label}</b>
                {currency && (
                  <span className="hidden truncate text-[13px] text-text-secondary sheet:block">
                    {currency.name}
                  </span>
                )}
              </div>
            </div>

            {type === "FOREX" ? (
              <>
                <InputAddon
                  size="sm"
                  prefix="₦"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`${label} buy`}
                  changed={gold(row.id, "buy")}
                  aria-invalid={invalid(row.id, "buy")}
                  className={cn(off && "opacity-50")}
                  {...register(`rows.${index}.buy`)}
                />
                <InputAddon
                  size="sm"
                  prefix="₦"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`${label} sell`}
                  changed={gold(row.id, "sell")}
                  aria-invalid={invalid(row.id, "sell")}
                  className={cn(off && "opacity-50")}
                  {...register(`rows.${index}.sell`)}
                />
              </>
            ) : (
              <>
                <InputAddon
                  size="sm"
                  suffix="%"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`${label} rate`}
                  changed={gold(row.id, "rate")}
                  aria-invalid={invalid(row.id, "rate")}
                  className={cn(off && "opacity-50")}
                  {...register(`rows.${index}.rate`)}
                />
                <Input
                  placeholder="Note (optional)"
                  autoComplete="off"
                  maxLength={NOTE_MAX}
                  aria-label={`${label} note`}
                  data-changed={gold(row.id, "note") || undefined}
                  aria-invalid={invalid(row.id, "note")}
                  className={cn(
                    "col-[2/-1] h-[38px] text-[14px] sheet:col-auto",
                    "data-changed:border-accent-gold data-changed:bg-accent-gold-soft/40 data-changed:ring-3 data-changed:ring-accent-gold/20",
                    off && "opacity-50",
                  )}
                  {...register(`rows.${index}.note`)}
                />
              </>
            )}
          </div>
        );
      })}

      <div
        className={cn(
          "mt-3 flex items-center gap-2 text-[13.5px] text-text-secondary",
          over && "text-state-error",
        )}
      >
        <span
          aria-hidden="true"
          className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-[3px] bg-border-subtle"
        >
          <i
            className={cn(
              "block h-full rounded-[3px] bg-accent-primary",
              over && "bg-state-error",
            )}
            style={{
              width: `${Math.min(100, (included / Math.max(1, maxRows)) * 100)}%`,
            }}
          />
        </span>
        {included} of {maxRows} rows used
      </div>
    </>
  );
}
