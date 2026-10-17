"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Callout } from "@/components/callout";
import { EntityDrawer } from "@/components/entity-drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ACCOUNT_SERVICE_LABELS,
  DESK_SERVICES,
} from "@/features/deals/services";
import { savePaymentAccount } from "@/features/deals/settings-actions";
import {
  accountNameDiffers,
  type PaymentAccountForm,
  paymentAccountInput,
  type PaymentAccountValues,
} from "@/features/deals/settings-schema";
import { FieldError } from "@/features/settings/components/settings-parts";

export type PaymentAccountRow = PaymentAccountForm & { id: string };

const EMPTY: PaymentAccountForm = {
  bank: "",
  accountNumber: "",
  accountName: "",
  currency: "NGN",
  services: [],
  active: true,
};

const FIELDS = [
  "bank",
  "accountNumber",
  "accountName",
  "currency",
  "services",
] as const;

// settings-deal-desk.html → Our payment accounts: add or edit one account.
// Deactivating hides it from new deals; deals that showed it keep it.
export function PaymentAccountDrawer({
  account,
  open,
  onOpenChange,
  orgName,
}: {
  account: PaymentAccountRow | null; // null = add
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PaymentAccountForm, unknown, PaymentAccountValues>({
    resolver: zodResolver(paymentAccountInput),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) reset(account ?? EMPTY);
  }, [open, account, reset]);

  const accountName = useWatch({ control, name: "accountName" });
  const differs =
    accountName.trim().length > 1 && accountNameDiffers(accountName, orgName);

  const onSubmit = handleSubmit(async (values) => {
    const result = await savePaymentAccount(values);
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
    toast.success(account ? "Account saved" : "Account added");
  });

  const err = (field: string) => `${id}-${field}-error`;

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={account ? "Edit payment account" : "Add payment account"}
      description="Shown to a customer only on a deal your team has agreed, and only when a rep picks it."
      submitLabel={account ? "Save changes" : "Add account"}
      pendingLabel="Saving…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-bank`}>Bank</Label>
        <Input
          id={`${id}-bank`}
          autoComplete="off"
          aria-invalid={errors.bank ? true : undefined}
          aria-describedby={errors.bank ? err("bank") : undefined}
          {...register("bank")}
        />
        <FieldError id={err("bank")} message={errors.bank?.message} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-number`}>Account number</Label>
          <Input
            id={`${id}-number`}
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
            aria-invalid={errors.accountNumber ? true : undefined}
            aria-describedby={
              errors.accountNumber ? err("accountNumber") : undefined
            }
            {...register("accountNumber")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-currency`}>Currency</Label>
          <Input
            id={`${id}-currency`}
            maxLength={3}
            autoComplete="off"
            className="uppercase"
            aria-invalid={errors.currency ? true : undefined}
            aria-describedby={errors.currency ? err("currency") : undefined}
            {...register("currency")}
          />
        </div>
      </div>
      <FieldError
        id={err("accountNumber")}
        message={errors.accountNumber?.message}
      />
      <FieldError id={err("currency")} message={errors.currency?.message} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Account name</Label>
        <Input
          id={`${id}-name`}
          autoComplete="off"
          aria-invalid={errors.accountName ? true : undefined}
          aria-describedby={errors.accountName ? err("accountName") : undefined}
          {...register("accountName")}
        />
        <FieldError
          id={err("accountName")}
          message={errors.accountName?.message}
        />
      </div>
      {differs && (
        <Callout tone="warn">
          This name isn’t “{orgName}”. Deals that show this account warn your
          rep to tell the customer the account name on WhatsApp first.
        </Callout>
      )}

      <fieldset
        className="flex flex-col gap-2.5"
        aria-describedby={errors.services ? err("services") : undefined}
      >
        <legend className="mb-1 text-[14px] font-semibold">Show for</legend>
        <Controller
          control={control}
          name="services"
          render={({ field }) => (
            <>
              {DESK_SERVICES.map((service) => (
                <label
                  key={service}
                  className="flex items-center gap-2.5 text-[14.5px]"
                >
                  <Checkbox
                    checked={field.value.includes(service)}
                    onCheckedChange={(on) =>
                      field.onChange(
                        on
                          ? [...field.value, service]
                          : field.value.filter((s) => s !== service),
                      )
                    }
                  />
                  {ACCOUNT_SERVICE_LABELS[service]}
                </label>
              ))}
            </>
          )}
        />
        <FieldError id={err("services")} message={errors.services?.message} />
      </fieldset>

      <label className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4 text-[14.5px] font-semibold">
        Active
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Account active"
            />
          )}
        />
      </label>

      {errors.root?.message && (
        <p role="alert" className="text-[13.5px] font-medium text-state-error">
          {errors.root.message}
        </p>
      )}
    </EntityDrawer>
  );
}
