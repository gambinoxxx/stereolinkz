"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Lock } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SETTINGS_SERVICES } from "@/features/deals/services";
import {
  createStaffCode,
  deactivateReferralCode,
  setMemberWhatsapp,
  updateReferralSettings,
} from "@/features/referrals/actions";
import { programmeLabel } from "@/features/referrals/labels";
import type { ProgrammeView, StaffCodeRow } from "@/features/referrals/queries";
import {
  referralSettingsInput,
  type ReferralSettingsForm,
} from "@/features/referrals/schema";
import {
  FieldError,
  Section,
  Select,
} from "@/features/settings/components/settings-parts";
import { SettingsTabs } from "@/features/settings/components/SettingsTabs";
import { useRouter } from "next/navigation";

const ROW =
  "flex items-center justify-between gap-3 py-2.5 text-[14.5px] font-semibold";

type Member = { id: string; name: string; whatsapp: string | null };

// Settings → Referrals (Phase 13c): the programme (on/off, window, reward
// %, hold, new customers only, monthly cap, services), staff codes and the
// team's own numbers. Read-only unless you're the owner; the actions check
// the role again on the server.
export function ReferralSettings({
  isOwner,
  programme,
  initial,
  codes,
  members,
  siteOrigin,
}: {
  isOwner: boolean;
  programme: ProgrammeView;
  initial: ReferralSettingsForm;
  codes: StaffCodeRow[];
  members: Member[];
  siteOrigin: string;
}) {
  const id = useId();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ReferralSettingsForm, unknown, ReferralSettingsForm>({
    resolver: zodResolver(referralSettingsInput) as never,
    defaultValues: initial,
  });
  useEffect(() => reset(initial), [initial, reset]);

  // The server checks the raw form values itself (not the resolver's
  // transformed output, which it would read differently).
  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const result = await updateReferralSettings(values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
        setError(field as keyof ReferralSettingsForm, { message });
      toast.error(result.error);
      return;
    }
    reset(values);
    toast.success("Referral settings saved");
    router.refresh();
  });
  const err = (field: string) => `${id}-${field}-error`;
  const status = programmeLabel(programme);

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <PageHeader
          title="Settings"
          description="The referral programme: who earns, how much and when."
          actions={
            isOwner ? (
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting && (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                )}
                {isSubmitting ? "Saving…" : "Save settings"}
              </Button>
            ) : undefined
          }
        />
        <SettingsTabs current="referrals" />
        {!isOwner && (
          <p className="mb-5 flex items-center gap-2 rounded-control bg-bg-subtle px-3.5 py-3 text-[14px] text-text-secondary">
            <Lock aria-hidden="true" className="size-4" strokeWidth={1.9} />
            Only the owner can change the referral programme.
          </p>
        )}

        <fieldset disabled={!isOwner} className="contents">
          <Section
            title="Programme"
            description="A referrer earns a share of our profit on each referred deal. Off, or outside its dates, codes are ignored for new deals; rewards already earned are still paid."
          >
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <label className={ROW}>
                  <span>
                    Referral programme
                    <span
                      className={`ml-2.5 text-[13px] font-medium ${status.tone === "on" ? "text-state-success" : "text-text-muted"}`}
                    >
                      {status.text}
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    aria-label="Referral programme on"
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-starts`}>Starts on</Label>
                <Input
                  id={`${id}-starts`}
                  type="date"
                  aria-invalid={errors.startsOn ? true : undefined}
                  {...register("startsOn")}
                />
                <FieldError
                  id={err("startsOn")}
                  message={errors.startsOn?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-ends`}>Last day</Label>
                <Input
                  id={`${id}-ends`}
                  type="date"
                  aria-invalid={errors.endsOn ? true : undefined}
                  {...register("endsOn")}
                />
                <FieldError
                  id={err("endsOn")}
                  message={errors.endsOn?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-pct`}>Reward (% of our profit)</Label>
                <Input
                  id={`${id}-pct`}
                  inputMode="decimal"
                  aria-invalid={errors.rewardPct ? true : undefined}
                  {...register("rewardPct")}
                />
                <FieldError
                  id={err("rewardPct")}
                  message={errors.rewardPct?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-hold`}>Hold before paying (days)</Label>
                <Input
                  id={`${id}-hold`}
                  inputMode="numeric"
                  aria-invalid={errors.holdDays ? true : undefined}
                  {...register("holdDays")}
                />
                <FieldError
                  id={err("holdDays")}
                  message={errors.holdDays?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={`${id}-cap`}>
                  Monthly cap per referrer (₦){" "}
                  <span className="font-normal text-text-muted">optional</span>
                </Label>
                <Input
                  id={`${id}-cap`}
                  inputMode="numeric"
                  placeholder="No cap"
                  aria-invalid={errors.monthlyCap ? true : undefined}
                  {...register("monthlyCap")}
                />
                <FieldError
                  id={err("monthlyCap")}
                  message={errors.monthlyCap?.message}
                />
              </div>
            </div>
            <Controller
              control={control}
              name="newCustomersOnly"
              render={({ field }) => (
                <label className={ROW}>
                  <span>
                    New customers only
                    <span className="block text-[13px] font-normal text-text-muted">
                      A code counts only if the WhatsApp number has no earlier
                      completed deal.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    aria-label="New customers only"
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />
          </Section>

          <Section
            title="Eligible services"
            description="Deals that can carry a referral code."
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
                          aria-label={`Referrals for ${svc.label}`}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next
                                ? [
                                    ...new Set([
                                      ...field.value,
                                      ...svc.services,
                                    ]),
                                  ]
                                : field.value.filter(
                                    (s) =>
                                      !(
                                        svc.services as readonly string[]
                                      ).includes(s),
                                  ),
                            )
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            />
            <FieldError
              id={err("services")}
              message={errors.services?.message}
            />
          </Section>
        </fieldset>
      </form>

      <StaffCodes
        isOwner={isOwner}
        codes={codes}
        members={members}
        siteOrigin={siteOrigin}
      />
      <TeamNumbers isOwner={isOwner} members={members} />
    </>
  );
}

function StaffCodes({
  isOwner,
  codes,
  members,
  siteOrigin,
}: {
  isOwner: boolean;
  codes: StaffCodeRow[];
  members: Member[];
  siteOrigin: string;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [v, setV] = useState({
    membershipId: members[0]?.id ?? "",
    code: "",
    whatsapp: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const link = (code: string) => `${siteOrigin}/?ref=${code}`;

  return (
    <Section
      title="Staff codes"
      description="A team member shares their link; deals that start from it carry their code."
    >
      {codes.length === 0 ? (
        <p className="text-[14px] text-text-secondary">No codes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {codes.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <div className="min-w-0">
                <b className="block font-mono tracking-wide">{c.code}</b>
                <span className="text-[13px] text-text-secondary">
                  {c.memberName} · {c.deals} deal{c.deals === 1 ? "" : "s"}
                </span>
              </div>
              <Badge variant={c.active ? "success" : "default"}>
                {c.active ? "Active" : "Inactive"}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-start-1 justify-self-start sm:col-start-auto"
                onClick={async () => {
                  await navigator.clipboard.writeText(link(c.code));
                  toast.success(`Copied ${link(c.code)}`);
                }}
              >
                <Copy strokeWidth={1.9} />
                Copy link
              </Button>
              {isOwner && c.active && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(
                        `Deactivate ${c.code}? New deals can't use it; rewards already earned stay.`,
                      )
                    )
                      return;
                    start(async () => {
                      const r = await deactivateReferralCode(c.id);
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success(`${c.code} deactivated`);
                        router.refresh();
                      }
                    });
                  }}
                >
                  Deactivate
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <div className="grid gap-3.5 rounded-[12px] border border-border-default p-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-member`}>Team member</Label>
            <Select
              id={`${id}-member`}
              value={v.membershipId}
              onChange={(e) =>
                setV((s) => ({ ...s, membershipId: e.target.value }))
              }
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <FieldError
              id={`${id}-member-error`}
              message={errors.membershipId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>Code</Label>
            <Input
              id={`${id}-code`}
              placeholder="e.g. LYDIA"
              autoCapitalize="characters"
              value={v.code}
              aria-invalid={errors.code ? true : undefined}
              onChange={(e) =>
                setV((s) => ({ ...s, code: e.target.value.toUpperCase() }))
              }
            />
            <FieldError id={`${id}-code-error`} message={errors.code} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-wa`}>
              Their WhatsApp{" "}
              <span className="font-normal text-text-muted">optional</span>
            </Label>
            <Input
              id={`${id}-wa`}
              inputMode="tel"
              placeholder="0803 123 4567"
              value={v.whatsapp}
              aria-invalid={errors.whatsapp ? true : undefined}
              onChange={(e) =>
                setV((s) => ({ ...s, whatsapp: e.target.value }))
              }
            />
            <FieldError id={`${id}-wa-error`} message={errors.whatsapp} />
          </div>
          <div className="sm:col-span-3">
            <Button
              type="button"
              disabled={busy || !v.code.trim()}
              onClick={() =>
                start(async () => {
                  const r = await createStaffCode({
                    ...v,
                    whatsapp: v.whatsapp || undefined,
                  });
                  if (!r.ok) {
                    setErrors(r.fieldErrors ?? {});
                    toast.error(r.error);
                    return;
                  }
                  setErrors({});
                  setV((s) => ({ ...s, code: "", whatsapp: "" }));
                  toast.success(`Code ${r.data.code} created`);
                  router.refresh();
                })
              }
            >
              {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
              Create code
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function TeamNumbers({
  isOwner,
  members,
}: {
  isOwner: boolean;
  members: Member[];
}) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [numbers, setNumbers] = useState(
    Object.fromEntries(members.map((m) => [m.id, m.whatsapp ?? ""])),
  );
  return (
    <Section
      title="Team numbers"
      description="Each team member's own WhatsApp number: their code never counts on a deal from it."
    >
      <ul className="flex flex-col gap-3">
        {members.map((m) => (
          <li
            key={m.id}
            className="grid items-end gap-2.5 sm:grid-cols-[1fr_1fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-${m.id}`}>{m.name}</Label>
              <Input
                id={`${id}-${m.id}`}
                inputMode="tel"
                placeholder="Not set"
                disabled={!isOwner}
                value={numbers[m.id] ?? ""}
                onChange={(e) =>
                  setNumbers((s) => ({ ...s, [m.id]: e.target.value }))
                }
              />
            </div>
            <span className="hidden sm:block" />
            {isOwner && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || (numbers[m.id] ?? "") === (m.whatsapp ?? "")}
                onClick={() =>
                  start(async () => {
                    const r = await setMemberWhatsapp({
                      membershipId: m.id,
                      whatsapp: numbers[m.id] ?? "",
                    });
                    if (!r.ok) toast.error(r.error);
                    else {
                      toast.success("Number saved");
                      router.refresh();
                    }
                  })
                }
              >
                Save
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
