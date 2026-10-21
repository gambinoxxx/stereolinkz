"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Lock } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createCampaign,
  createStaffCode,
  deactivateReferralCode,
  endCampaign,
  setMemberWhatsapp,
  startCampaign,
  updateProgrammeRules,
} from "@/features/referrals/actions";
import { campaignLabel, dayLabel } from "@/features/referrals/labels";
import type { CampaignRow, StaffCodeRow } from "@/features/referrals/queries";
import {
  type CampaignForm,
  programmeRulesInput,
  type ProgrammeRulesForm,
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

const CAMPAIGN_VARIANT = {
  running: "success",
  scheduled: "brand",
  ended: "default",
  off: "default",
} as const;

// Settings → Referrals: campaigns (one active at a time), the programme
// rules (hold, monthly cap), staff codes and the team's own numbers.
// Read-only unless you're the owner; every action checks the role again.
export function ReferralSettings({
  isOwner,
  campaigns,
  rules,
  codes,
  members,
  siteOrigin,
  defaults,
}: {
  isOwner: boolean;
  campaigns: CampaignRow[];
  rules: ProgrammeRulesForm;
  codes: StaffCodeRow[];
  members: Member[];
  siteOrigin: string;
  defaults: { startsOn: string; endsOn: string }; // a new campaign's dates
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Referrals: campaigns, the rules that apply to all of them, and staff codes."
      />
      <SettingsTabs current="referrals" />
      {!isOwner && (
        <p className="mb-5 flex items-center gap-2 rounded-control bg-bg-subtle px-3.5 py-3 text-[14px] text-text-secondary">
          <Lock aria-hidden="true" className="size-4" strokeWidth={1.9} />
          Only the owner can change referrals.
        </p>
      )}
      <Campaigns isOwner={isOwner} campaigns={campaigns} defaults={defaults} />
      <ProgrammeRules isOwner={isOwner} rules={rules} />
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

function Campaigns({
  isOwner,
  campaigns,
  defaults,
}: {
  isOwner: boolean;
  campaigns: CampaignRow[];
  defaults: { startsOn: string; endsOn: string };
}) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [v, setV] = useState<CampaignForm>({
    name: "",
    startsOn: defaults.startsOn,
    endsOn: defaults.endsOn,
    rewardPct: "15",
    includeCrypto: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong.");
      toast.success(done);
      router.refresh();
    });
  return (
    <Section
      title="Campaigns"
      description="A referral earns a share of our profit only on deals made while a campaign is on. One at a time; start and end them here."
    >
      {campaigns.length === 0 ? (
        <p className="text-[14px] text-text-secondary">
          No campaigns yet. Create one below, then start it.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3"
            >
              <div className="min-w-0">
                <b className="block">{c.name}</b>
                <span className="text-[13px] text-text-secondary">
                  {dayLabel(c.startsOn)} – {dayLabel(c.endsOn)} · {c.pct}% of
                  our profit
                  {c.includeCrypto ? " · crypto included" : ""} · {c.deals} deal
                  {c.deals === 1 ? "" : "s"}
                </span>
              </div>
              <Badge variant={CAMPAIGN_VARIANT[c.status]}>
                {campaignLabel(c)}
              </Badge>
              {isOwner && (
                <div className="col-span-2">
                  {c.active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            `End “${c.name}”? Rewards already earned stay.`,
                          )
                        )
                          return;
                        run(() => endCampaign(c.id), "Campaign ended");
                      }}
                    >
                      End campaign
                    </Button>
                  ) : (
                    c.status !== "ended" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => startCampaign(c.id), "Campaign started")
                        }
                      >
                        Start campaign
                      </Button>
                    )
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <div className="grid gap-3.5 rounded-[12px] border border-border-default p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              placeholder="e.g. Launch, Nov–Dec"
              value={v.name}
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))}
            />
            <FieldError id={`${id}-name-error`} message={errors.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-starts`}>Starts on</Label>
            <Input
              id={`${id}-starts`}
              type="date"
              value={v.startsOn}
              onChange={(e) =>
                setV((s) => ({ ...s, startsOn: e.target.value }))
              }
            />
            <FieldError id={`${id}-starts-error`} message={errors.startsOn} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-ends`}>Last day</Label>
            <Input
              id={`${id}-ends`}
              type="date"
              value={v.endsOn}
              onChange={(e) => setV((s) => ({ ...s, endsOn: e.target.value }))}
            />
            <FieldError id={`${id}-ends-error`} message={errors.endsOn} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-pct`}>Reward (% of our profit)</Label>
            <Input
              id={`${id}-pct`}
              inputMode="decimal"
              value={v.rewardPct}
              aria-invalid={errors.rewardPct ? true : undefined}
              onChange={(e) =>
                setV((s) => ({ ...s, rewardPct: e.target.value }))
              }
            />
            <FieldError id={`${id}-pct-error`} message={errors.rewardPct} />
          </div>
          <label className={`${ROW} self-end`}>
            Include crypto deals
            <Switch
              checked={v.includeCrypto}
              aria-label="Include crypto deals"
              onCheckedChange={(on) =>
                setV((s) => ({ ...s, includeCrypto: on }))
              }
            />
          </label>
          <div className="sm:col-span-2">
            <Button
              disabled={busy || v.name.trim().length < 2}
              onClick={() =>
                start(async () => {
                  const r = await createCampaign(v);
                  if (!r.ok) {
                    setErrors(r.fieldErrors ?? {});
                    return void toast.error(r.error);
                  }
                  setErrors({});
                  setV((s) => ({ ...s, name: "" }));
                  toast.success(
                    "Campaign created. Start it when you’re ready.",
                  );
                  router.refresh();
                })
              }
            >
              {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
              Create campaign
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function ProgrammeRules({
  isOwner,
  rules,
}: {
  isOwner: boolean;
  rules: ProgrammeRulesForm;
}) {
  const id = useId();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProgrammeRulesForm>({
    resolver: zodResolver(programmeRulesInput) as never,
    defaultValues: rules,
  });
  useEffect(() => reset(rules), [rules, reset]);
  // The server checks the raw values itself.
  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const r = await updateProgrammeRules(values);
    if (!r.ok) {
      for (const [field, message] of Object.entries(r.fieldErrors ?? {}))
        setError(field as keyof ProgrammeRulesForm, { message });
      return void toast.error(r.error);
    }
    reset(values);
    toast.success("Rules saved");
    router.refresh();
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={!isOwner} className="contents">
        <Section
          title="Rules for every campaign"
          description="Only new customers count (no earlier completed deal), never the code owner’s own number, and only their first deal earns."
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-hold`}>Hold before paying (days)</Label>
              <Input
                id={`${id}-hold`}
                inputMode="numeric"
                aria-invalid={errors.holdDays ? true : undefined}
                {...register("holdDays")}
              />
              <FieldError
                id={`${id}-hold-error`}
                message={errors.holdDays?.message}
              />
            </div>
            <div className="flex flex-col gap-1.5">
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
                id={`${id}-cap-error`}
                message={errors.monthlyCap?.message}
              />
            </div>
          </div>
          {isOwner && (
            <div>
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting && (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                )}
                Save rules
              </Button>
            </div>
          )}
        </Section>
      </fieldset>
    </form>
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
