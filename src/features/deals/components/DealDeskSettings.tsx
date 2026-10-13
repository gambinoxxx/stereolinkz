"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { BankMark } from "@/components/bank-mark";
import { InputAddon } from "@/components/input-addon";
import { PageHeader } from "@/components/shell/page-header";
import { StatusChip } from "@/components/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PaymentAccountDrawer,
  type PaymentAccountRow,
} from "@/features/deals/components/PaymentAccountDrawer";
import { SERVICE_LABELS, SETTINGS_SERVICES } from "@/features/deals/services";
import { updateDealSettings } from "@/features/deals/settings-actions";
import {
  accountNameDiffers,
  type DealSettings,
  type DealSettingsForm,
  dealSettingsInput,
  formatAccountNumber,
} from "@/features/deals/settings-schema";
import {
  FieldError,
  Section,
  Select,
} from "@/features/settings/components/settings-parts";
import { SettingsTabs } from "@/features/settings/components/SettingsTabs";

const ROW =
  "flex items-center justify-between gap-3 py-2.5 text-[14.5px] font-semibold";

// settings-deal-desk.html, Phase 12 sections: services, our payment
// accounts, timings and team alerts. Crypto wallets come in Phase 13.
export function DealDeskSettings({
  initial,
  orgName,
  members,
  accounts,
  crypto,
  emailReady,
}: {
  initial: DealSettingsForm;
  orgName: string;
  members: { id: string; name: string }[];
  accounts: PaymentAccountRow[];
  crypto: { rateLockMinutes: number; payoutTargetMinutes: number };
  emailReady: boolean; // RESEND_API_KEY and DEAL_ALERT_FROM are set
}) {
  const id = useId();
  const [editing, setEditing] = useState<PaymentAccountRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<DealSettingsForm, unknown, DealSettings>({
    resolver: zodResolver(dealSettingsInput),
    defaultValues: initial,
  });

  // After a save the server's values become the new baseline.
  useEffect(() => reset(initial), [initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateDealSettings(values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
        if (
          field === "contactSlaMinutes" ||
          field === "dealRefPrefix" ||
          field === "dealDefaultOwnerId"
        )
          setError(field, { message }, { shouldFocus: true });
      toast.error(result.error);
      return;
    }
    reset(values);
    toast.success("Deal desk settings saved");
  });

  const openAccount = (account: PaymentAccountRow | null) => {
    setEditing(account);
    setDrawerOpen(true);
  };
  const err = (field: string) => `${id}-${field}-error`;

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <PageHeader
          title="Settings"
          description="How the Deal desk works: services, our payment accounts and timings."
          actions={
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting && (
                <Loader2 aria-hidden="true" className="animate-spin" />
              )}
              {isSubmitting ? "Saving…" : "Save settings"}
            </Button>
          }
        />
        <SettingsTabs current="deal-desk" />

        <Section
          title="Services"
          description="Which deals customers can start on the website. Turning one off hides it; open deals continue."
        >
          <Controller
            control={control}
            name="services"
            render={({ field }) => (
              <div className="divide-y divide-border-subtle">
                {SETTINGS_SERVICES.map((svc) => {
                  const on = svc.services.every((s) =>
                    field.value.includes(s as never),
                  );
                  return (
                    <label key={svc.key} className={ROW}>
                      {svc.label}
                      <Switch
                        checked={on}
                        aria-label={`${svc.label} on the website`}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next
                              ? [...new Set([...field.value, ...svc.services])]
                              : field.value.filter(
                                  (s) => !svc.services.includes(s),
                                ),
                          )
                        }
                      />
                    </label>
                  );
                })}
                <div className={`${ROW} text-text-muted`}>
                  <span>
                    Sell crypto (USDT, USDC)
                    <span className="block text-[12.5px] font-normal">
                      Coming in the next update
                    </span>
                  </span>
                  <Switch
                    checked={false}
                    disabled
                    aria-label="Sell crypto on the website (coming in the next update)"
                  />
                </div>
              </div>
            )}
          />
          <p className="text-[13px] text-text-muted">
            Cash forex is never offered on the website; customers are sent to
            WhatsApp.
          </p>
        </Section>

        <Section
          title="Our payment accounts"
          description="Shown to a customer only on a confirmed deal, and only the one your rep picks."
        >
          {accounts.length === 0 ? (
            <p className="text-[14px] text-text-secondary">
              No accounts yet. Add the accounts customers may pay into.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {accounts.map((account) => {
                const differs = accountNameDiffers(
                  account.accountName,
                  orgName,
                );
                return (
                  <li
                    key={account.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                  >
                    <BankMark
                      name={account.bank}
                      slug={account.bank.toLowerCase()}
                      size={34}
                    />
                    <div className="min-w-0">
                      <b className="block tabular-nums">
                        {account.bank} ·{" "}
                        {formatAccountNumber(account.accountNumber)}
                      </b>
                      <span className="text-[13px] text-text-secondary">
                        {account.accountName} · {account.currency} ·{" "}
                        {account.services
                          .map((s) => SERVICE_LABELS[s])
                          .join(", ")}
                      </span>
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      {!account.active ? (
                        <StatusChip status="INACTIVE" />
                      ) : differs ? (
                        <Badge variant="gold">
                          Name differs from {orgName}
                        </Badge>
                      ) : (
                        <StatusChip status="ACTIVE" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="col-start-2 justify-self-start sm:col-start-auto"
                      onClick={() => openAccount(account)}
                    >
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openAccount(null)}
            >
              <Plus strokeWidth={1.9} />
              Add account
            </Button>
          </div>
          <p className="text-[13px] text-text-muted">
            An account whose name isn’t “{orgName}” shows a warning to your rep
            to tell the customer the account name on WhatsApp first.
          </p>
        </Section>

        <Section
          title="Timings"
          description="Promises the customer sees. Keep them realistic."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sla`}>
                Flag new deals not contacted after
              </Label>
              <InputAddon
                id={`${id}-sla`}
                suffix="minutes"
                inputMode="numeric"
                aria-invalid={errors.contactSlaMinutes ? true : undefined}
                aria-describedby={
                  errors.contactSlaMinutes ? err("sla") : undefined
                }
                {...register("contactSlaMinutes")}
              />
              <FieldError
                id={err("sla")}
                message={errors.contactSlaMinutes?.message}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-prefix`}>Deal reference prefix</Label>
              <Input
                id={`${id}-prefix`}
                maxLength={6}
                className="uppercase"
                autoComplete="off"
                aria-invalid={errors.dealRefPrefix ? true : undefined}
                aria-describedby={
                  errors.dealRefPrefix ? err("prefix") : `${id}-prefix-hint`
                }
                {...register("dealRefPrefix")}
              />
              <FieldError
                id={err("prefix")}
                message={errors.dealRefPrefix?.message}
              />
              <span
                id={`${id}-prefix-hint`}
                className="text-[12.5px] text-text-muted"
              >
                New deals only; existing references don’t change.
              </span>
            </div>
            <div className="flex flex-col gap-1.5 opacity-60">
              <Label htmlFor={`${id}-lock`}>Crypto rate lock</Label>
              <InputAddon
                id={`${id}-lock`}
                suffix="minutes"
                value={crypto.rateLockMinutes}
                disabled
                readOnly
              />
              <span className="text-[12.5px] text-text-muted">
                Used for crypto deals (next update).
              </span>
            </div>
            <div className="flex flex-col gap-1.5 opacity-60">
              <Label htmlFor={`${id}-payout`}>Crypto payout target</Label>
              <InputAddon
                id={`${id}-payout`}
                suffix="minutes"
                value={crypto.payoutTargetMinutes}
                disabled
                readOnly
              />
              <span className="text-[12.5px] text-text-muted">
                Used for crypto deals (next update).
              </span>
            </div>
          </div>
        </Section>

        <Section title="Team alerts" description="Who hears about new deals.">
          <label className={ROW}>
            <span>
              Email every team member on a new deal
              {!emailReady && (
                <span className="block text-[12.5px] font-normal text-text-muted">
                  Email isn’t set up yet. New deals still show on the Deals
                  badge and the dashboard.
                </span>
              )}
            </span>
            <Controller
              control={control}
              name="dealAlertEmails"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Email every team member on a new deal"
                />
              )}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-owner`}>Default owner for new deals</Label>
            <Controller
              control={control}
              name="dealDefaultOwnerId"
              render={({ field }) => (
                <Select
                  id={`${id}-owner`}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  aria-invalid={errors.dealDefaultOwnerId ? true : undefined}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            />
            <FieldError
              id={err("owner")}
              message={errors.dealDefaultOwnerId?.message}
            />
          </div>
          <p className="text-[13px] text-text-muted">
            WhatsApp: use one business number on the WhatsApp Business app and
            link it on each team member’s device, so everyone sees the same
            chats.
          </p>
        </Section>
      </form>

      <PaymentAccountDrawer
        account={editing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orgName={orgName}
      />
    </>
  );
}
