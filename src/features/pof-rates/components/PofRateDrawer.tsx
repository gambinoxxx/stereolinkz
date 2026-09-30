"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { RecentChanges } from "@/components/recent-changes";
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
import { savePofRate } from "@/features/pof-rates/actions";
import type { BankOption, PofBankItem } from "@/features/pof-rates/queries";
import {
  NOTE_MAX,
  NOTE_SUGGESTIONS,
  type PofRateFormInput,
  pofRateInput,
  type PofRateValues,
} from "@/features/pof-rates/schema";
import { formatPercent, formatShortDateTime } from "@/lib/format";

export type PofDrawerState =
  | { mode: "add"; bankId?: string } // bankId: preselected from the callout
  | { mode: "edit"; bank: PofBankItem };

type PofRateDrawerProps = {
  state: PofDrawerState | null; // open while set
  onOpenChange: (open: boolean) => void;
  bankOptions: BankOption[]; // ACTIVE banks
  timeZone: string;
  now: string;
};

const FIELDS = ["bankId", "rate", "note", "pofActive"] as const;
const ACTIVATE_BANK_FIRST = "Activate the bank on the Banks page first";

// "3.40" → "3.4" for the input (the % sits in the suffix).
const rateForInput = (rate: string) => formatPercent(rate).replace(/%$/, "");

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}

// pof-add.html and pof-edit.html share this drawer.
export function PofRateDrawer({
  state,
  onOpenChange,
  bankOptions,
  timeZone,
  now,
}: PofRateDrawerProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PofRateFormInput, unknown, PofRateValues>({
    resolver: zodResolver(pofRateInput),
    defaultValues: { bankId: "", rate: "", note: "", pofActive: true },
  });

  const editBank = state?.mode === "edit" ? state.bank : null;
  const current = editBank?.rates[0];

  // Start from the bank's current values (edit) or empty (add) each time.
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const latest = state.bank.rates[0];
      reset({
        bankId: state.bank.id,
        rate: latest ? rateForInput(latest.rate) : "",
        note: latest?.note ?? "",
        pofActive: state.bank.pofActive,
      });
    } else {
      reset({
        bankId: state.bankId ?? "",
        rate: "",
        note: "",
        pofActive: true,
      });
    }
  }, [state, reset]);

  const bankId = useWatch({ control, name: "bankId" });
  const pofActive = useWatch({ control, name: "pofActive" });
  const bankInactive = editBank !== null && editBank.status !== "ACTIVE";
  const label = editBank ? (editBank.shortName ?? editBank.name) : "";

  const onSubmit = handleSubmit(async (values) => {
    if (!state) return;
    const result = await savePofRate(values, state.mode);
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields) {
        const name = FIELDS.find((f) => f === field);
        if (name) setError(name, { message });
      }
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }
    if (result.data.unchanged) {
      toast("No changes to save"); // the drawer stays open
      return;
    }
    onOpenChange(false);
    const { label: saved, rateChanged, firstRate } = result.data;
    toast.success(
      firstRate
        ? `${saved} rate added`
        : rateChanged
          ? `${saved} rate saved. The previous rate is in history.`
          : `${saved} updated`,
    );
  });

  const err = (field: string) => `${id}-${field}-error`;
  const nowDate = new Date(now);

  return (
    <EntityDrawer
      open={state !== null}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={editBank ? `Edit ${label} POF rate` : "Add POF rate"}
      description={editBank ? editBank.name : "Pick a bank and set its rate."}
      submitLabel={editBank ? "Save changes" : "Add rate"}
      pendingLabel="Saving…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-bank`}>Bank</Label>
        <Select
          value={bankId || undefined}
          disabled={editBank !== null}
          onValueChange={(value) =>
            setValue("bankId", value, { shouldDirty: true })
          }
        >
          <SelectTrigger
            id={`${id}-bank`}
            aria-invalid={errors.bankId ? true : undefined}
            aria-describedby={errors.bankId ? err("bankId") : undefined}
          >
            <SelectValue placeholder="Choose a bank" />
          </SelectTrigger>
          <SelectContent>
            {editBank ? (
              <SelectItem value={editBank.id}>{editBank.name}</SelectItem>
            ) : (
              bankOptions.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.currentRate
                    ? `${bank.name} (now ${formatPercent(bank.currentRate)})`
                    : bank.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {!editBank && (
          <span className="text-[13px] text-text-muted">
            Only active banks are listed. Need another?{" "}
            <Link
              href="/admin/banks"
              className="rounded font-semibold text-accent-primary hover:underline"
            >
              Add a bank
            </Link>
          </span>
        )}
        <FieldError id={err("bankId")} message={errors.bankId?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-rate`}>Rate per month</Label>
          <InputAddon
            id={`${id}-rate`}
            suffix="%"
            inputMode="decimal"
            placeholder="3.4"
            autoComplete="off"
            aria-invalid={errors.rate ? true : undefined}
            aria-describedby={errors.rate ? err("rate") : undefined}
            {...register("rate")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>Note</Label>
          <Input
            id={`${id}-note`}
            placeholder="Optional"
            maxLength={NOTE_MAX}
            list={`${id}-notes`}
            autoComplete="off"
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? err("note") : undefined}
            {...register("note")}
          />
          <datalist id={`${id}-notes`}>
            {NOTE_SUGGESTIONS.map((note) => (
              <option key={note} value={note} />
            ))}
          </datalist>
        </div>
      </div>
      <FieldError id={err("rate")} message={errors.rate?.message} />
      <FieldError id={err("note")} message={errors.note?.message} />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <Switch
            id={`${id}-active`}
            checked={pofActive}
            disabled={bankInactive}
            aria-describedby={bankInactive ? `${id}-active-hint` : undefined}
            onCheckedChange={(checked) =>
              setValue("pofActive", checked, { shouldDirty: true })
            }
          />
          <Label
            htmlFor={`${id}-active`}
            className="font-medium text-text-secondary"
          >
            Active and shown on new POF boards
          </Label>
        </div>
        {bankInactive && (
          <span
            id={`${id}-active-hint`}
            className="text-[13px] text-text-muted"
          >
            {ACTIVATE_BANK_FIRST}. You can still update its rate.
          </span>
        )}
        <FieldError id={err("pofActive")} message={errors.pofActive?.message} />
      </div>

      {errors.root?.message && (
        <p role="alert" className="text-[13.5px] font-medium text-state-error">
          {errors.root.message}
        </p>
      )}

      {editBank && current && (
        <RecentChanges
          heading="Rate"
          rows={editBank.rates.map((rate) => ({
            id: rate.id,
            when: formatShortDateTime(
              new Date(rate.createdAt),
              nowDate,
              timeZone,
            ),
            value: (
              <>
                {formatPercent(rate.rate)}
                {rate.note && (
                  <span className="text-text-muted">, {rate.note}</span>
                )}
              </>
            ),
          }))}
        />
      )}
    </EntityDrawer>
  );
}
