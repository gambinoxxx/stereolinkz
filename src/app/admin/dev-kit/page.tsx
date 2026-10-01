import {
  Download,
  Layers,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { notFound } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { BankMark } from "@/components/bank-mark";
import { Callout } from "@/components/callout";
import { CurrencyFlag } from "@/components/currency-flag";
import { EmptyState } from "@/components/empty-state";
import { InputAddon } from "@/components/input-addon";
import { RateDelta } from "@/components/rate-delta";
import { PageHeader } from "@/components/shell/page-header";
import { StatusChip } from "@/components/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { flagDataUri } from "@/features/templates/assets/flags";
import { requireMember } from "@/lib/server/auth";

import { BoardComparison } from "./board-comparison";
import { DashboardEmpty } from "./dashboard-empty";
import {
  DialogDemo,
  DrawerDemo,
  PendingDemo,
  SegmentedDemo,
  SelectDemo,
  TabsDemo,
  ToastDemo,
  TooltipDemo,
} from "./demos";

// Dev only: every primitive and project component in every state, with
// sample props (no data). Removed in Phase 10.
export default async function DevKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await requireMember();

  return (
    <div className="flex flex-col gap-6 [&>div:first-child]:mb-0">
      <PageHeader
        title="Dev kit"
        description="Every component in every state. Development only."
      />

      <Section title="Dashboard: new organization">
        <div className="p-5">
          <DashboardEmpty />
        </div>
      </Section>

      <Section title="Boards: preview vs PNG">
        <BoardComparison />
      </Section>

      <Section title="Buttons">
        <Row label="Variants">
          <Button>
            <Sparkles strokeWidth={1.9} />
            Generate image
          </Button>
          <Button variant="outline">
            <Pencil strokeWidth={1.9} />
            Update rates
          </Button>
          <Button variant="ghost">Deactivate</Button>
          <Button variant="destructive">
            <Trash2 strokeWidth={1.9} />
            Delete bank
          </Button>
          <Button variant="link">All currencies</Button>
        </Row>
        <Row label="Sizes">
          <Button>Default 40px</Button>
          <Button size="sm">Small 32px</Button>
          <Button size="sm" variant="outline">
            Edit
          </Button>
          <Button size="icon" variant="ghost" aria-label="Edit rate">
            <Pencil strokeWidth={1.9} />
          </Button>
          <Button size="icon" variant="outline" aria-label="Download">
            <Download strokeWidth={1.9} />
          </Button>
        </Row>
        <Row label="Disabled">
          <Button disabled>Save changes</Button>
          <Button disabled variant="outline">
            Cancel
          </Button>
          <Button disabled variant="ghost">
            Deactivate
          </Button>
          <Button disabled variant="destructive">
            Delete bank
          </Button>
        </Row>
        <Row label="Pending">
          <PendingDemo />
        </Row>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-5 sheet:grid-cols-2">
          <Field label="Default" htmlFor="dk-default">
            <Input id="dk-default" placeholder="Bank name" />
          </Field>
          <Field label="Filled" htmlFor="dk-filled">
            <Input id="dk-filled" defaultValue="Acme Bank" />
          </Field>
          <Field label="Disabled" htmlFor="dk-disabled">
            <Input id="dk-disabled" defaultValue="USD" disabled />
          </Field>
          <Field
            label="Error"
            htmlFor="dk-error"
            error="Bank name is required."
          >
            <Input
              id="dk-error"
              aria-invalid="true"
              aria-describedby="dk-error-msg"
            />
          </Field>
          <Field label="Select" htmlFor="dk-select">
            <SelectDemo id="dk-select" />
          </Field>
          <Field
            label="Textarea"
            htmlFor="dk-textarea"
            hint="Printed at the bottom of every board."
          >
            <Textarea
              id="dk-textarea"
              defaultValue="Rates can change without notice."
            />
          </Field>
        </div>
      </Section>

      <Section title="Input add-ons">
        <div className="grid gap-5 sheet:grid-cols-2">
          <Field label="We buy" htmlFor="dk-buy">
            <InputAddon
              id="dk-buy"
              prefix="₦"
              inputMode="decimal"
              defaultValue="1365"
            />
          </Field>
          <Field
            label="Changed"
            htmlFor="dk-changed"
            hint="Edited values turn gold."
          >
            <InputAddon
              id="dk-changed"
              prefix="₦"
              inputMode="decimal"
              defaultValue="1370"
              changed
            />
          </Field>
          <Field
            label="Error"
            htmlFor="dk-addon-error"
            error="Sell must be the same as or higher than buy."
          >
            <InputAddon
              id="dk-addon-error"
              prefix="₦"
              inputMode="decimal"
              defaultValue="1300"
              aria-invalid="true"
            />
          </Field>
          <Field label="Disabled" htmlFor="dk-addon-disabled">
            <InputAddon
              id="dk-addon-disabled"
              prefix="₦"
              defaultValue="1378"
              disabled
            />
          </Field>
          <Field label="Suffix" htmlFor="dk-pof">
            <InputAddon
              id="dk-pof"
              suffix="%"
              inputMode="decimal"
              defaultValue="3.4"
            />
          </Field>
          <Field label="Small, changed" htmlFor="dk-sm">
            <InputAddon
              id="dk-sm"
              size="sm"
              prefix="₦"
              inputMode="decimal"
              defaultValue="1845"
              changed
            />
          </Field>
        </div>
      </Section>

      <Section title="Switches, checkboxes, filters">
        <Row label="Switch">
          <SwitchRow id="dk-sw-on" label="Active" defaultChecked />
          <SwitchRow id="dk-sw-off" label="Inactive" />
          <SwitchRow id="dk-sw-dis" label="Disabled" defaultChecked disabled />
        </Row>
        <Row label="Checkbox">
          <CheckRow id="dk-cb-on" label="Include" defaultChecked />
          <CheckRow id="dk-cb-off" label="Include" />
          <CheckRow id="dk-cb-dis" label="Disabled" disabled />
        </Row>
        <Row label="Segmented">
          <SegmentedDemo />
        </Row>
        <Row label="Tabs">
          <TabsDemo />
        </Row>
      </Section>

      <Section title="Chips and deltas">
        <Row label="Status">
          <StatusChip status="ACTIVE" />
          <StatusChip status="INACTIVE" />
          <StatusChip status="ARCHIVED" />
        </Row>
        <Row label="Badges">
          <Badge>Default</Badge>
          <Badge variant="brand">Default template</Badge>
          <Badge variant="gold">New account</Badge>
          <Badge variant="success">Generated</Badge>
          <Badge variant="destructive">Failed</Badge>
        </Row>
        <Row label="Amount">
          <RateDelta kind="amount" current="1365.0000" previous="1361.0000" />
          <RateDelta kind="amount" current="1815.0000" previous="1820.0000" />
          <RateDelta kind="amount" current="1365.5000" previous="1364.2500" />
          <RateDelta kind="amount" current="1560.0000" previous="1560" />
          <span className="text-[13px] text-text-muted">
            (no previous rate:
            <RateDelta kind="amount" current="1560.0000" previous={null} />
            nothing)
          </span>
        </Row>
        <Row label="Points">
          <RateDelta kind="points" current="3.40" previous="3.30" />
          <RateDelta kind="points" current="2.10" previous="2.35" />
          <RateDelta kind="points" current="3.40" previous="3.4" />
        </Row>
      </Section>

      <Section title="Flags and bank marks">
        <Row label="Flags">
          <CurrencyFlag flagCode="us" currencyCode="USD" size={28} />
          <CurrencyFlag flagCode="gb" currencyCode="GBP" size={34} />
          <CurrencyFlag flagCode="eu" currencyCode="EUR" size={44} />
          <CurrencyFlag flagCode={null} currencyCode="AED" size={28} />
          <CurrencyFlag flagCode="zz" currencyCode="AED" size={34} />
          <CurrencyFlag flagCode={null} currencyCode="AED" size={44} />
        </Row>
        <Row label="Monograms">
          {SAMPLE_BANKS.map((bank) => (
            <BankMark key={bank} name={bank} slug={bank.toLowerCase()} />
          ))}
        </Row>
        <Row label="Sizes, logo">
          <BankMark name="Acme Bank" slug="acme" size={28} />
          <BankMark name="Acme Bank" slug="acme" size={34} />
          <BankMark name="Acme Bank" slug="acme" size={44} />
          <BankMark
            name="Logo sample"
            slug="logo"
            logoUrl={flagDataUri("ng")}
            size={44}
          />
        </Row>
      </Section>

      <Section title="Callouts, empty states, loading">
        <Callout>
          Every change is kept in rate history. Old boards never change.
        </Callout>
        <Callout tone="warn">
          Edited rates will be saved as new rates when you generate.
        </Callout>
        <div className="grid gap-5 sheet:grid-cols-2">
          <EmptyState
            icon={Layers}
            title="No banks yet"
            description="Add a bank to start adding POF rates."
            action={<Button size="sm">Add bank</Button>}
          />
          <EmptyState
            icon={RefreshCw}
            title="No boards yet"
            description="Boards you generate appear here with their rates."
          />
        </div>
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </Section>

      <Section title="Drawer, dialog, tooltip, toast">
        <Row label="Overlays">
          <DrawerDemo />
          <DialogDemo />
          <TooltipDemo />
          <ToastDemo />
        </Row>
      </Section>
    </div>
  );
}

// Made-up names: the dev kit never names a real bank.
const SAMPLE_BANKS = [
  "Acme",
  "Harbor",
  "Keystone",
  "Meridian",
  "Northwind",
  "Summit",
  "Tidewater",
  "Vantage",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-panel border border-border-default bg-bg-surface">
      <h2 className="border-b border-border-subtle px-5 py-[15px] text-base font-bold tracking-[-0.1px]">
        {title}
      </h2>
      <div className="flex flex-col gap-5 p-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sheet:flex-row sheet:items-center sheet:gap-4">
      <span className="w-28 shrink-0 text-[12.5px] font-semibold text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[13px] text-text-muted">{hint}</p>}
      {error && (
        <p
          id={`${htmlFor}-msg`}
          role="alert"
          className="text-[13.5px] font-medium text-state-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  ...props
}: { id: string; label: string } & ComponentProps<typeof Switch>) {
  return (
    <div className="flex items-center gap-[9px]">
      <Switch id={id} {...props} />
      <Label htmlFor={id} className="font-medium text-text-secondary">
        {label}
      </Label>
    </div>
  );
}

function CheckRow({
  id,
  label,
  ...props
}: { id: string; label: string } & ComponentProps<typeof Checkbox>) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} {...props} />
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
    </div>
  );
}
