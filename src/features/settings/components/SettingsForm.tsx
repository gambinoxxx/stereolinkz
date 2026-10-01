"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgSettings } from "@/features/settings/actions";
import { OrgLogoField } from "@/features/settings/components/OrgLogoField";
import { contrastWarning } from "@/features/settings/contrast";
import {
  normalizeHexColour,
  type OrgSettings,
  type OrgSettingsForm,
  orgSettingsInput,
} from "@/features/settings/schema";
import { BRAND_TEXT } from "@/features/templates/theme";
import { cn } from "@/lib/utils";

type SettingsFormProps = {
  initial: OrgSettingsForm;
  logoUrl: string | null;
  member: { name: string; role: string };
};

const COMMON_ZONES = [
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
];

const LEAVE =
  "Leave without saving? Your changes to the settings will be lost.";

const selectClass =
  "h-[42px] w-full appearance-none pr-9 min-w-0 rounded-control border border-border-input bg-bg-surface px-3 text-[15px] text-text-primary outline-none focus:border-accent-primary focus:ring-3 focus:ring-accent-primary/14 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-invalid:border-state-error";

function Section({
  title,
  description,
  soon,
  children,
}: {
  title: string;
  description: string;
  soon?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-3.5 border-t border-border-default py-[26px] first-of-type:border-t-0 first-of-type:pt-0 shell:grid-cols-[260px_minmax(0,1fr)] shell:gap-8",
        soon && "opacity-60",
      )}
    >
      <div>
        <h2 className="text-[16.5px] font-bold">{title}</h2>
        <p className="mt-1 text-[13.5px] text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-panel border border-border-default bg-bg-surface p-[22px]">
        {children}
      </div>
    </section>
  );
}

// A native select (long lists, phone pickers) with the design's chevron.
function Select(props: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={selectClass} />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
        strokeWidth={1.9}
      />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}

// The form's shape for a saved value: nulls back to empty inputs.
const toForm = (s: OrgSettings): OrgSettingsForm => ({
  ...s,
  email: s.email ?? "",
  defaultFinePrint: s.defaultFinePrint ?? "",
});

// settings.html. Company details, brand colours and board defaults feed
// every new board; saved boards keep the values in their snapshot.
export function SettingsForm({ initial, logoUrl, member }: SettingsFormProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OrgSettingsForm, unknown, OrgSettings>({
    resolver: zodResolver(orgSettingsInput),
    defaultValues: initial,
  });

  // Leaving with unsaved changes asks first: closing or reloading the tab,
  // and links inside the app (the App Router has no navigation guard).
  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.origin !== window.location.origin || link.target === "_blank")
        return;
      if (!window.confirm(LEAVE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isDirty]);

  async function onSubmit(values: OrgSettings) {
    const result = await updateOrgSettings(values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
        setError(field as keyof OrgSettingsForm, { message });
      toast.error(result.error);
      return;
    }
    reset(toForm(values));
    toast.success(
      result.data.changed
        ? "Settings saved. New boards will use them."
        : "No changes to save",
    );
  }

  const err = (field: string) => `${id}-${field}-error`;
  const aria = (field: keyof OrgSettingsForm) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": err(field) }
      : {};

  const colours = useWatch({
    control,
    name: ["backgroundColor", "primaryColor", "accentColor"],
  });
  const swatches = [
    {
      field: "backgroundColor" as const,
      label: "Background",
      value: colours[0],
      text: BRAND_TEXT.onBackground,
    },
    {
      field: "primaryColor" as const,
      label: "Buy and rates",
      value: colours[1],
      text: BRAND_TEXT.onPrimary,
    },
    {
      field: "accentColor" as const,
      label: "Sell and highlights",
      value: colours[2],
      text: BRAND_TEXT.onAccent,
    },
  ];
  const zones = (Intl.supportedValuesOf("timeZone") as string[]).filter(
    (zone) => !COMMON_ZONES.some((c) => c.value === zone),
  );

  return (
    <form id="settings-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title="Settings"
        description="Company details and brand colours used on every board."
        actions={
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && (
              <Loader2 aria-hidden="true" className="animate-spin" />
            )}
            {isSubmitting ? "Saving…" : "Save settings"}
          </Button>
        }
      />

      <Section
        title="Company"
        description="Shown on boards and in the WhatsApp contact line."
      >
        <div className="grid gap-3.5 sheet:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Company name</Label>
            <Input
              id={`${id}-name`}
              autoComplete="organization"
              {...aria("name")}
              {...register("name")}
            />
            <FieldError id={err("name")} message={errors.name?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-phone`}>WhatsApp number</Label>
            <Input
              id={`${id}-phone`}
              inputMode="tel"
              autoComplete="tel"
              {...aria("contactLine")}
              {...register("contactLine")}
            />
            <FieldError
              id={err("contactLine")}
              message={errors.contactLine?.message}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            placeholder="Optional"
            {...aria("email")}
            {...register("email")}
          />
          <FieldError id={err("email")} message={errors.email?.message} />
        </div>
        <OrgLogoField initialUrl={logoUrl} />
      </Section>

      <Section
        title="Brand colours"
        description="Templates read these. Changes apply to new boards only."
      >
        <div className="grid gap-3 sheet:grid-cols-3">
          {swatches.map((swatch) => {
            const hex = normalizeHexColour(swatch.value ?? "");
            const warning = hex ? contrastWarning(hex, swatch.text) : null;
            const message = errors[swatch.field]?.message;
            return (
              <div key={swatch.field} className="flex min-w-0 flex-col gap-1.5">
                <div
                  className={cn(
                    "flex items-center gap-2.5 rounded-control border border-border-default p-2 focus-within:border-accent-primary",
                    message && "border-state-error",
                  )}
                >
                  {/* The native picker sits under the swatch: click the
                      colour to pick, or type the hex. */}
                  <label className="relative size-[34px] shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
                    <span
                      className="absolute inset-0"
                      style={{ background: hex ?? "transparent" }}
                    />
                    <input
                      type="color"
                      aria-label={`${swatch.label} colour picker`}
                      value={(hex ?? "#000000").toLowerCase()}
                      onChange={(event) =>
                        setValue(
                          swatch.field,
                          event.target.value.toUpperCase(),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </label>
                  <div className="min-w-0">
                    <label
                      htmlFor={`${id}-${swatch.field}`}
                      className="block text-[12px] text-text-muted"
                    >
                      {swatch.label}
                    </label>
                    <input
                      id={`${id}-${swatch.field}`}
                      maxLength={7}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full min-w-0 border-0 bg-transparent text-[14px] font-semibold uppercase outline-none"
                      {...aria(swatch.field)}
                      {...register(swatch.field)}
                    />
                  </div>
                </div>
                <FieldError id={err(swatch.field)} message={message} />
                {!message && warning && (
                  <p className="text-[13px] font-medium text-accent-gold-text">
                    {warning}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Boards" description="Defaults for every new board.">
        <div className="grid gap-3.5 sheet:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-tz`}>Time zone</Label>
            <Select
              id={`${id}-tz`}
              {...aria("timezone")}
              {...register("timezone")}
            >
              <optgroup label="Common">
                {COMMON_ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All time zones">
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </optgroup>
            </Select>
            <span className="text-[13px] text-text-muted">
              Dates on boards use this, not the server clock.
            </span>
            <FieldError
              id={err("timezone")}
              message={errors.timezone?.message}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-size`}>Image size</Label>
            <Select id={`${id}-size`} disabled>
              <option>1080 × 1920 (WhatsApp Status)</option>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fine`}>Default small print</Label>
          <Input
            id={`${id}-fine`}
            {...aria("defaultFinePrint")}
            {...register("defaultFinePrint")}
          />
          <span className="text-[13px] text-text-muted">
            Used on new Forex and POF boards. Leave it empty to use each board
            type’s own.
          </span>
          <FieldError
            id={err("defaultFinePrint")}
            message={errors.defaultFinePrint?.message}
          />
        </div>
      </Section>

      <Section
        title="Team"
        description="Invite editors and viewers. Coming after the first release."
        soon
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-sidebar-avatar text-[14px] font-bold text-primary-foreground"
          >
            {member.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <b className="block">{member.name}</b>
            <span className="text-[13px] text-text-secondary">
              {member.role}
            </span>
          </div>
          <span className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-full bg-border-subtle px-[9px] text-[12.5px] font-semibold text-text-secondary">
            <Lock aria-hidden="true" className="size-3" strokeWidth={2} />
            Roles later
          </span>
        </div>
      </Section>
    </form>
  );
}
