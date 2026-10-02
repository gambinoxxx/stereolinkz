"use client";

import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CoinBadge } from "@/components/coin-badge";
import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { RecentChanges } from "@/components/recent-changes";
import { StatusChip } from "@/components/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CoinListItem } from "@/features/coins/queries";
import { networksInput } from "@/features/coins/schema";
import {
  saveCoinEdit,
  updateCoinDetails,
} from "@/features/crypto-rates/actions";
import { CoinIconPicker } from "@/features/crypto-rates/components/CoinIconPicker";
import { CryptoSpreadHint } from "@/features/crypto-rates/components/CryptoSpreadHint";
import { cryptoRateInput } from "@/features/coins/schema";
import {
  formatBoardPrice,
  formatRate,
  formatShortDateTime,
} from "@/lib/format";

type CryptoRateDrawerProps = {
  coin: CoinListItem | null; // open while set
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  now: string; // ISO
};

type Values = { buy: string; sell: string; networks: string };

// crypto-edit.html: a new rate (a new CryptoRate row) and the networks
// shown on boards, saved together in one transaction. The ticker and
// name are fixed once added; the icon changes at once, on its own.
export function CryptoRateDrawer({
  coin,
  onOpenChange,
  timeZone,
  now,
}: CryptoRateDrawerProps) {
  const id = useId();
  // A new icon shows at once; it belongs to the coin it was picked for.
  const [changedIcon, setChangedIcon] = useState<{
    coinId: string;
    url: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: { buy: "", sell: "", networks: "" },
  });

  const current = coin?.rates[0];
  // Prefill with the current rate and networks every time it opens.
  useEffect(() => {
    if (!coin) return;
    reset({
      buy: current ? formatBoardPrice(current.buy) : "",
      sell: current ? formatBoardPrice(current.sell) : "",
      networks: coin.networks.join(", "),
    });
  }, [coin, current, reset]);
  const iconUrl =
    coin && changedIcon?.coinId === coin.id
      ? changedIcon.url
      : (coin?.iconUrl ?? null);

  const buy = useWatch({ control, name: "buy" });
  const sell = useWatch({ control, name: "sell" });

  const onSubmit = handleSubmit(async (values) => {
    if (!coin) return;
    // The shared rules, client side first (the server checks again).
    const rate = cryptoRateInput.safeParse({ coinId: coin.id, ...values });
    const networks = networksInput.safeParse(values.networks);
    if (!rate.success || !networks.success) {
      for (const issue of [
        ...(rate.error?.issues ?? []),
        ...(networks.error?.issues ?? []),
      ]) {
        const field =
          issue.path[0] === "sell"
            ? "sell"
            : issue.path[0] === "buy"
              ? "buy"
              : "networks";
        if (!errors[field]) setError(field, { message: issue.message });
      }
      return;
    }
    const result = await saveCoinEdit({ coinId: coin.id, ...values });
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields)
        if (field === "buy" || field === "sell" || field === "networks")
          setError(field, { message });
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }
    const { ticker, rateChanged, detailsChanged } = result.data;
    if (!rateChanged && !detailsChanged) {
      toast("No changes to save"); // the drawer stays open
      return;
    }
    onOpenChange(false);
    toast.success(
      rateChanged
        ? `${ticker} saved. The previous rate is in history.`
        : `${ticker} updated`,
    );
  });

  async function changeIcon(url: string) {
    if (!coin) return;
    const result = await updateCoinDetails({ coinId: coin.id, iconUrl: url });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setChangedIcon({ coinId: coin.id, url });
    toast.success(`${coin.ticker} icon updated`);
  }

  const rateError = errors.buy?.message ?? errors.sell?.message;
  const errorId = `${id}-error`;
  const nowDate = new Date(now);
  const ticker = coin?.ticker ?? "";

  return (
    <EntityDrawer
      open={coin !== null}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={`Edit ${ticker} rate`}
      description={`Naira per $1 of ${coin?.name ?? ""}`}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      {coin && (
        <>
          <div className="flex items-center gap-3">
            <CoinBadge
              ticker={coin.ticker}
              name={coin.name}
              iconUrl={iconUrl}
              badgeColor={coin.badgeColor}
              size={44}
            />
            <div className="min-w-0">
              <b className="block text-[17px] leading-tight">{coin.ticker}</b>
              <span className="text-[13px] text-text-secondary">
                {coin.name}
              </span>
              <CoinIconPicker
                id={`${id}-icon`}
                onUploaded={changeIcon}
                onError={(message) => toast.error(message)}
                className="block text-[13px] font-semibold text-accent-primary hover:underline"
              >
                {iconUrl ? "Change icon" : "Add icon"}
              </CoinIconPicker>
            </div>
            <div className="ml-auto">
              <StatusChip status={coin.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-buy`}>We buy, per $1</Label>
              <InputAddon
                id={`${id}-buy`}
                prefix="₦"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.buy ? true : undefined}
                aria-describedby={rateError ? errorId : undefined}
                {...register("buy", {
                  onChange: () => clearErrors(["buy", "sell"]),
                })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sell`}>We sell, per $1</Label>
              <InputAddon
                id={`${id}-sell`}
                prefix="₦"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.sell ? true : undefined}
                aria-describedby={rateError ? errorId : undefined}
                {...register("sell", {
                  onChange: () => clearErrors(["buy", "sell"]),
                })}
              />
            </div>
          </div>

          <CryptoSpreadHint buy={buy} sell={sell} />
          {(rateError ?? errors.root?.message) && (
            <p
              id={errorId}
              role="alert"
              className="text-[13.5px] font-medium text-state-error"
            >
              {rateError ?? errors.root?.message}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-networks`}>Networks shown on boards</Label>
            <Input
              id={`${id}-networks`}
              placeholder="TRC20, BEP20"
              autoComplete="off"
              aria-invalid={errors.networks ? true : undefined}
              aria-describedby={`${id}-networks-hint`}
              {...register("networks", {
                onChange: () => clearErrors("networks"),
              })}
            />
            <span
              id={`${id}-networks-hint`}
              className="text-[13px] text-text-muted"
            >
              Comma-separated, at most 2 on boards. Saved on the coin, not in
              rate history.
            </span>
            {errors.networks?.message && (
              <p className="text-[13.5px] font-medium text-state-error">
                {errors.networks.message}
              </p>
            )}
          </div>

          <RecentChanges
            heading="Buy / Sell per $1"
            rows={coin.rates.map((rate) => ({
              id: rate.id,
              when: formatShortDateTime(
                new Date(rate.createdAt),
                nowDate,
                timeZone,
              ),
              value: `${formatRate(rate.buy)} / ${formatRate(rate.sell)}`,
            }))}
          />
        </>
      )}
    </EntityDrawer>
  );
}
