"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CoinBadge } from "@/components/coin-badge";
import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  COIN_NAME_MAX,
  coinInput,
  type CoinFormInput,
  type CoinValues,
} from "@/features/coins/schema";
import { createCoin } from "@/features/crypto-rates/actions";
import { CoinIconPicker } from "@/features/crypto-rates/components/CoinIconPicker";
import { CryptoSpreadHint } from "@/features/crypto-rates/components/CryptoSpreadHint";

type CoinDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY: CoinFormInput = {
  ticker: "",
  name: "",
  networks: "",
  iconUrl: null,
  active: true,
  buy: "",
  sell: "",
};

const FIELDS = ["ticker", "name", "networks", "buy", "sell"] as const;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}

// crypto-add.html: a coin and its first rate in one step. The icon uploads
// as soon as it is picked; without one, boards show the first letter on a
// colour picked from the ticker.
export function CoinDrawer({ open, onOpenChange }: CoinDrawerProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CoinFormInput, unknown, CoinValues>({
    resolver: zodResolver(coinInput),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const ticker = useWatch({ control, name: "ticker" });
  const name = useWatch({ control, name: "name" });
  const iconUrl = useWatch({ control, name: "iconUrl" });
  const active = useWatch({ control, name: "active" });
  const buy = useWatch({ control, name: "buy" });
  const sell = useWatch({ control, name: "sell" });

  const onSubmit = handleSubmit(async (values) => {
    const result = await createCoin(values);
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields) {
        const key = FIELDS.find((f) => f === field);
        if (key) setError(key, { message }, { shouldFocus: true });
      }
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }
    onOpenChange(false);
    toast.success(`${result.data.ticker} added`);
  });

  const err = (field: string) => `${id}-${field}-error`;
  const described = (field: keyof typeof errors) =>
    errors[field] ? err(field) : undefined;
  const rateError = errors.buy?.message ?? errors.sell?.message;

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title="Add coin"
      description="It becomes available to crypto boards straight away."
      submitLabel="Add coin"
      pendingLabel="Adding…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-ticker`}>Ticker</Label>
          <Input
            id={`${id}-ticker`}
            placeholder="TON"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            className="uppercase placeholder:normal-case"
            aria-invalid={errors.ticker ? true : undefined}
            aria-describedby={described("ticker")}
            {...register("ticker", {
              onChange: (event) =>
                setValue("ticker", event.target.value.toUpperCase()),
            })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>Name shown on boards</Label>
          <Input
            id={`${id}-name`}
            placeholder="Toncoin"
            maxLength={COIN_NAME_MAX}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={described("name")}
            {...register("name")}
          />
        </div>
      </div>
      <FieldError id={err("ticker")} message={errors.ticker?.message} />
      <FieldError id={err("name")} message={errors.name?.message} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-networks`}>Networks</Label>
        <Input
          id={`${id}-networks`}
          placeholder="TON"
          autoComplete="off"
          aria-invalid={errors.networks ? true : undefined}
          aria-describedby={`${id}-networks-hint`}
          {...register("networks")}
        />
        <span
          id={`${id}-networks-hint`}
          className="text-[13px] text-text-muted"
        >
          Comma-separated, e.g. TRC20, BEP20. Boards show at most 2.
        </span>
        <FieldError id={err("networks")} message={errors.networks?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Coin icon</span>
        <CoinIconPicker
          id={`${id}-icon`}
          onUploaded={(url) => {
            clearErrors("iconUrl");
            setValue("iconUrl", url, { shouldDirty: true });
          }}
          onError={(message) => setError("iconUrl", { message })}
          className="flex items-center gap-3.5 rounded-[12px] border-[1.5px] border-dashed border-border-input bg-bg-subtle p-4 transition-colors hover:border-accent-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-primary"
        >
          {ticker.trim() || name.trim() || iconUrl ? (
            <CoinBadge
              ticker={ticker || "?"}
              name={name}
              iconUrl={iconUrl}
              size={44}
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-text-muted text-[17px] font-bold text-primary-foreground"
            >
              ?
            </span>
          )}
          <span className="min-w-0">
            <b className="block text-[14px]">
              {iconUrl ? "Change icon" : "Upload icon"}
            </b>
            <span className="block text-[13px] text-text-muted">
              Square PNG or SVG, at least 256 px. Without one, boards show the
              first letter on a colour.
            </span>
          </span>
        </CoinIconPicker>
        {errors.iconUrl?.message && (
          <p className="text-[13.5px] font-medium text-state-error">
            {errors.iconUrl.message}
          </p>
        )}
        {iconUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setValue("iconUrl", null, { shouldDirty: true })}
          >
            Remove icon
          </Button>
        )}
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
            aria-describedby={rateError ? err("rate") : undefined}
            {...register("buy")}
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
            aria-describedby={rateError ? err("rate") : undefined}
            {...register("sell")}
          />
        </div>
      </div>
      <CryptoSpreadHint
        buy={buy}
        sell={sell}
        fallback="Naira per $1 of coin value. For a stablecoin that is per coin."
      />
      <FieldError id={err("rate")} message={rateError} />

      <div className="flex items-center gap-2.5">
        <Switch
          id={`${id}-active`}
          checked={active}
          onCheckedChange={(checked) =>
            setValue("active", checked, { shouldDirty: true })
          }
        />
        <Label
          htmlFor={`${id}-active`}
          className="font-medium text-text-secondary"
        >
          Active and shown on new boards
        </Label>
      </div>

      {errors.root?.message && (
        <p role="alert" className="text-[13.5px] font-medium text-state-error">
          {errors.root.message}
        </p>
      )}
    </EntityDrawer>
  );
}
