"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EntityDrawer } from "@/components/entity-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createBank, updateBank } from "@/features/banks/actions";
import { LogoField } from "@/features/banks/components/LogoField";
import type { BankListItem } from "@/features/banks/queries";
import { bankSlug } from "@/features/banks/slug";
import { bankInput, SHORT_NAME_MAX } from "@/features/banks/schema";
import {
  checkImageBytes,
  LOGO_ERRORS,
  MAX_LOGO_BYTES,
} from "@/lib/image-check";

type BankDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: BankListItem | null; // null = add a bank
};

// The shared bank fields plus the logo, which only exists in the browser.
const bankForm = bankInput.extend({
  logo: z.instanceof(File).nullable(),
  removeLogo: z.boolean(),
});
type BankFormValues = z.infer<typeof bankForm>;

const EMPTY: BankFormValues = {
  name: "",
  shortName: "",
  active: true,
  logo: null,
  removeLogo: false,
};

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
  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankForm),
    defaultValues: EMPTY,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
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
            logo: null,
            removeLogo: false,
          }
        : EMPTY,
    );
  }, [open, bank, reset]);

  const name = useWatch({ control, name: "name" });
  const active = useWatch({ control, name: "active" });
  const logo = useWatch({ control, name: "logo" });
  const removeLogo = useWatch({ control, name: "removeLogo" });

  // Fast feedback with the same byte checks the server runs again.
  async function pickLogo(file: File) {
    const check =
      file.size > MAX_LOGO_BYTES
        ? { ok: false as const, error: LOGO_ERRORS.size }
        : checkImageBytes(new Uint8Array(await file.arrayBuffer()));
    if (!check.ok) {
      setError("logo", { message: check.error });
      return;
    }
    clearErrors("logo");
    setValue("logo", file, { shouldDirty: true });
    setValue("removeLogo", false);
  }

  function clearLogo() {
    clearErrors("logo");
    setValue("logo", null, { shouldDirty: true });
    setValue("removeLogo", Boolean(bank?.logoUrl));
  }

  const onSubmit = handleSubmit(async (values) => {
    const data = new FormData();
    data.set("name", values.name);
    data.set("shortName", values.shortName);
    data.set("active", String(values.active));
    data.set("removeLogo", String(values.removeLogo));
    if (values.logo) data.set("logo", values.logo);

    const result = bank
      ? await updateBank(bank.id, data)
      : await createBank(data);

    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [field, message] of fields) {
        if (
          field === "name" ||
          field === "shortName" ||
          field === "active" ||
          field === "logo"
        ) {
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

      <LogoField
        id={`${id}-logo`}
        name={name}
        slug={bankSlug(name)}
        currentUrl={bank?.logoUrl ?? null}
        file={logo}
        removed={removeLogo}
        error={errors.logo?.message}
        onPick={pickLogo}
        onClear={clearLogo}
      />

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
