"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyFlag } from "@/components/currency-flag";
import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createCurrency } from "@/features/currencies/actions";
import {
  type CurrencyInput,
  currencyInput,
  type CurrencyValues,
} from "@/features/currencies/schema";
import { SpreadHint } from "@/features/forex-rates/components/SpreadHint";
import { FLAG_OPTIONS, type FlagCode } from "@/features/templates/assets/flags";

type CurrencyDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const NO_FLAG = "none"; // Radix Select items can't use "" as a value

// New currencies start without a flag, so none gets a wrong one by default.
const EMPTY: CurrencyInput = {
  code: "",
  name: "",
  symbol: "",
  flagCode: "",
  active: true,
  buy: "",
  sell: "",
};

const FIELDS = ["code", "name", "symbol", "flagCode", "buy", "sell"] as const;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}

// forex-add.html: a currency and its first rate in one step.
export function CurrencyDrawer({ open, onOpenChange }: CurrencyDrawerProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CurrencyInput, unknown, CurrencyValues>({
    resolver: zodResolver(currencyInput),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const code = useWatch({ control, name: "code" });
  const flagCode = useWatch({ control, name: "flagCode" });
  const active = useWatch({ control, name: "active" });
  const buy = useWatch({ control, name: "buy" });
  const sell = useWatch({ control, name: "sell" });

  const onSubmit = handleSubmit(async (values) => {
    const result = await createCurrency(values);
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields) {
        const name = FIELDS.find((f) => f === field);
        if (name) setError(name, { message }, { shouldFocus: true });
      }
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }
    onOpenChange(false);
    toast.success(`${result.data.code} added`);
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
      title="Add currency"
      description="It becomes available to forex boards straight away."
      submitLabel="Add currency"
      pendingLabel="Adding…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-code`}>Currency code</Label>
          <Input
            id={`${id}-code`}
            placeholder="3 letters"
            maxLength={3}
            autoComplete="off"
            autoCapitalize="characters"
            className="uppercase placeholder:normal-case"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={described("code")}
            {...register("code", {
              onChange: (event) =>
                setValue("code", event.target.value.toUpperCase()),
            })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-symbol`}>Symbol</Label>
          <Input
            id={`${id}-symbol`}
            placeholder="Optional"
            maxLength={4}
            autoComplete="off"
            aria-invalid={errors.symbol ? true : undefined}
            aria-describedby={described("symbol")}
            {...register("symbol")}
          />
        </div>
      </div>
      <FieldError id={err("code")} message={errors.code?.message} />
      <FieldError id={err("symbol")} message={errors.symbol?.message} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Name shown on boards</Label>
        <Input
          id={`${id}-name`}
          placeholder="Name on boards"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={described("name")}
          {...register("name")}
        />
        <FieldError id={err("name")} message={errors.name?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-flag`}>Flag</Label>
        <Select
          value={flagCode || NO_FLAG}
          onValueChange={(value) =>
            setValue("flagCode", value === NO_FLAG ? "" : (value as FlagCode), {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger
            id={`${id}-flag`}
            aria-invalid={errors.flagCode ? true : undefined}
            aria-describedby={described("flagCode")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLAG_OPTIONS.map((flag) => (
              <SelectItem key={flag.code} value={flag.code}>
                <CurrencyFlag
                  flagCode={flag.code}
                  currencyCode={flag.code}
                  size={28}
                />
                {flag.label}
              </SelectItem>
            ))}
            <SelectItem value={NO_FLAG}>
              <CurrencyFlag
                flagCode={null}
                currencyCode={code || "?"}
                size={28}
              />
              No flag
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldError id={err("flagCode")} message={errors.flagCode?.message} />
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
            aria-describedby={rateError ? err("rate") : undefined}
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
            aria-describedby={rateError ? err("rate") : undefined}
            {...register("sell")}
          />
        </div>
      </div>
      <SpreadHint buy={buy} sell={sell} />
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
