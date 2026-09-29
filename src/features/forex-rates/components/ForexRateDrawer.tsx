"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyFlag } from "@/components/currency-flag";
import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { StatusChip } from "@/components/status-chip";
import { Label } from "@/components/ui/label";
import type { CurrencyListItem } from "@/features/currencies/queries";
import { saveForexRate } from "@/features/forex-rates/actions";
import { SpreadHint } from "@/features/forex-rates/components/SpreadHint";
import {
  type ForexRateInput,
  forexRateInput,
} from "@/features/forex-rates/schema";
import {
  formatBoardPrice,
  formatRate,
  formatShortDateTime,
} from "@/lib/format";

type ForexRateDrawerProps = {
  currency: CurrencyListItem | null; // open while set
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  now: string; // ISO
};

// forex-edit.html: rates only; a currency's details are fixed once added.
export function ForexRateDrawer({
  currency,
  onOpenChange,
  timeZone,
  now,
}: ForexRateDrawerProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ForexRateInput>({
    resolver: zodResolver(forexRateInput),
    defaultValues: { currencyId: "", buy: "", sell: "" },
  });

  const current = currency?.rates[0];
  // Prefill with the current rate every time the drawer opens.
  useEffect(() => {
    if (!currency) return;
    reset({
      currencyId: currency.id,
      buy: current ? formatBoardPrice(current.buy) : "",
      sell: current ? formatBoardPrice(current.sell) : "",
    });
  }, [currency, current, reset]);

  const buy = useWatch({ control, name: "buy" });
  const sell = useWatch({ control, name: "sell" });

  const onSubmit = handleSubmit(async (values) => {
    const result = await saveForexRate(values);
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields)
        if (field === "buy" || field === "sell") setError(field, { message });
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }
    if (result.data.unchanged) {
      toast("No changes to save"); // the drawer stays open
      return;
    }
    onOpenChange(false);
    toast.success(
      `${result.data.code} saved. The previous rate is in history.`,
    );
  });

  const error =
    errors.buy?.message ?? errors.sell?.message ?? errors.root?.message;
  const errorId = `${id}-error`;
  const nowDate = new Date(now);
  const code = currency?.code ?? "";

  return (
    <EntityDrawer
      open={currency !== null}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={`Edit ${code} rate`}
      description={`Naira per 1 ${code}`}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      {currency && (
        <>
          <div className="flex items-center gap-3">
            <CurrencyFlag
              flagCode={currency.flagCode}
              currencyCode={currency.code}
              size={44}
            />
            <div className="min-w-0">
              <b className="block text-[17px] leading-tight">{currency.code}</b>
              <span className="text-[13px] text-text-secondary">
                {currency.name}
              </span>
            </div>
            <div className="ml-auto">
              <StatusChip status={currency.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-buy`}>We buy</Label>
              <InputAddon
                id={`${id}-buy`}
                prefix="₦"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.buy ? true : undefined}
                aria-describedby={errors.buy ? errorId : undefined}
                {...register("buy")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sell`}>We sell</Label>
              <InputAddon
                id={`${id}-sell`}
                prefix="₦"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.sell ? true : undefined}
                aria-describedby={errors.sell ? errorId : undefined}
                {...register("sell")}
              />
            </div>
          </div>

          <SpreadHint buy={buy} sell={sell} />
          {error && (
            <p
              id={errorId}
              role="alert"
              className="text-[13.5px] font-medium text-state-error"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Recent changes</span>
            <div className="overflow-hidden rounded-[12px] border border-border-default">
              <div className="flex justify-between border-b border-border-subtle bg-bg-subtle px-3.5 py-2.5 text-[12.5px] font-semibold text-text-muted">
                <span>When</span>
                <span>Buy / Sell</span>
              </div>
              {currency.rates.length === 0 ? (
                <p className="px-3.5 py-2.5 text-[14px] text-text-muted">
                  No rates yet.
                </p>
              ) : (
                <ul>
                  {currency.rates.map((rate) => (
                    <li
                      key={rate.id}
                      className="flex justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5 text-[14px] last:border-b-0"
                    >
                      <span className="text-text-secondary">
                        {formatShortDateTime(
                          new Date(rate.createdAt),
                          nowDate,
                          timeZone,
                        )}
                      </span>
                      <span className="tabular-nums">
                        {formatRate(rate.buy)} / {formatRate(rate.sell)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-[13px] text-text-muted">
              Saving adds a new entry. Nothing is overwritten.
            </span>
          </div>
        </>
      )}
    </EntityDrawer>
  );
}
