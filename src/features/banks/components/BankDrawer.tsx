"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BankMark } from "@/components/bank-mark";
import { EntityDrawer } from "@/components/entity-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createBank, updateBank } from "@/features/banks/actions";
import type { BankListItem } from "@/features/banks/queries";
import { bankSlug } from "@/features/banks/slug";
import {
  type BankInput,
  bankInput,
  SHORT_NAME_MAX,
} from "@/features/banks/schema";

type BankDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: BankListItem | null; // null = add a bank
};

const EMPTY: BankInput = { name: "", shortName: "", active: true };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}

// Add and edit share this drawer (bank-add.html, bank-edit.html).
export function BankDrawer({ open, onOpenChange, bank }: BankDrawerProps) {
  const id = useId();
  const form = useForm<BankInput>({
    resolver: zodResolver(bankInput),
    defaultValues: EMPTY,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  // Start from the chosen bank (or empty) every time the drawer opens.
  useEffect(() => {
    if (!open) return;
    reset(
      bank
        ? {
            name: bank.name,
            shortName: bank.shortName ?? "",
            active: bank.status === "ACTIVE",
          }
        : EMPTY,
    );
  }, [open, bank, reset]);

  const name = useWatch({ control, name: "name" });
  const active = useWatch({ control, name: "active" });

  const onSubmit = handleSubmit(async (values) => {
    const result = bank
      ? await updateBank(bank.id, values)
      : await createBank(values);

    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields) {
        if (field === "name" || field === "shortName" || field === "active") {
          setError(field, { message }, { shouldFocus: true });
        }
      }
      if (fields.length === 0) setError("root", { message: result.error });
      return;
    }

    onOpenChange(false);
    toast.success(
      bank
        ? `${result.data.name} updated`
        : `${result.data.name} added. Add its POF rate next.`,
    );
  });

  const nameError = `${id}-name-error`;
  const shortError = `${id}-short-error`;

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return; // finish the save first
        onOpenChange(next);
      }}
      title={bank ? `Edit ${bank.name}` : "Add bank"}
      description={
        bank
          ? "Changes apply to new boards. Old boards keep what they showed."
          : "New banks are ready for POF rates straight away."
      }
      submitLabel={bank ? "Save changes" : "Save bank"}
      pendingLabel="Saving…"
      pending={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Bank name</Label>
        <Input
          id={`${id}-name`}
          placeholder="Full bank name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? nameError : undefined}
          {...register("name")}
        />
        <FieldError id={nameError} message={errors.name?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-short`}>Short name</Label>
        <Input
          id={`${id}-short`}
          placeholder="Name on boards"
          autoComplete="off"
          maxLength={SHORT_NAME_MAX}
          aria-invalid={errors.shortName ? true : undefined}
          aria-describedby={`${id}-short-hint${errors.shortName ? ` ${shortError}` : ""}`}
          {...register("shortName")}
        />
        <span id={`${id}-short-hint`} className="text-[13px] text-text-muted">
          Printed on boards. Keep it under 14 characters.
        </span>
        <FieldError id={shortError} message={errors.shortName?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Logo</span>
        {/* Enabled in the Logo upload part of Phase 3 (needs the Blob store). */}
        <div
          aria-disabled="true"
          className="flex items-center gap-3.5 rounded-[12px] border-[1.5px] border-dashed border-border-input bg-bg-subtle p-4 opacity-70"
        >
          <BankMark
            name={name.trim() || "?"}
            slug={bankSlug(name)}
            logoUrl={bank?.logoUrl}
            size={44}
          />
          <div>
            <b className="text-[14px]">Upload logo</b>
            <p className="text-[13px] text-text-muted">
              Logo upload comes next. Without one, boards show the first letter.
            </p>
          </div>
        </div>
      </div>

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
          Active
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
