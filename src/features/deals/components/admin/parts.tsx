// Small pieces of deals.html / deal-detail.html shared by the queue and
// the detail page. No hooks: usable from server and client components.
import {
  Banknote,
  CircleDollarSign,
  FileText,
  Globe2,
  GraduationCap,
} from "lucide-react";
import type { ReactNode } from "react";

import { processingLabel } from "@/features/deals/progress";
import type { DealService, DealStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ICON: Record<DealService, { Icon: typeof GraduationCap; bg: string }> = {
  SCHOOL_FEES: { Icon: GraduationCap, bg: "bg-accent-primary" },
  INTL_PAYMENT: { Icon: Globe2, bg: "bg-deal-pay" },
  POF: { Icon: FileText, bg: "bg-bank-mark-3" },
  FOREX_SELL: { Icon: Banknote, bg: "bg-bg-sidebar" },
  FOREX_BUY: { Icon: Banknote, bg: "bg-bg-sidebar" },
  CRYPTO_SELL: { Icon: CircleDollarSign, bg: "bg-bank-mark-4" },
};

export function ServiceIcon({
  service,
  size = 36,
}: {
  service: DealService;
  size?: number;
}) {
  const { Icon, bg } = ICON[service];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[11px] text-white",
        bg,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </span>
  );
}

const CHIP: Record<string, string> = {
  new: "bg-accent-soft text-accent-primary",
  gold: "bg-accent-gold-soft text-accent-gold-text",
  recv: "bg-deal-recv-soft text-deal-recv",
  done: "bg-state-success-soft text-state-success",
  off: "bg-border-subtle text-text-muted",
  bad: "bg-state-error-soft text-state-error",
};

export function teamStatusLabel(
  service: DealService,
  status: DealStatus,
): { label: string; tone: keyof typeof CHIP } {
  switch (status) {
    case "NEW":
      return { label: "New", tone: "new" };
    case "AGREED":
      return { label: "Agreed", tone: "gold" };
    case "AWAITING_PAYMENT":
      return { label: "Awaiting payment", tone: "gold" };
    case "PAYMENT_RECEIVED":
      return { label: "Payment received", tone: "recv" };
    case "PROCESSING":
      return {
        label: processingLabel(service).replace("your", "their"),
        tone: "recv",
      };
    case "COMPLETED":
      return { label: "Completed", tone: "done" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "off" };
    // Crypto (Phase 13)
    case "AWAITING_DEPOSIT":
      return { label: "Waiting for deposit", tone: "gold" };
    case "DEPOSIT_SEEN":
      return { label: "Deposit seen", tone: "recv" };
    case "DEPOSIT_COMPLETE":
      return { label: "Deposit complete", tone: "bad" };
    case "PAID_OUT":
      return { label: "Paid out", tone: "done" };
    case "EXPIRED":
      return { label: "Expired", tone: "off" };
    case "FLAGGED":
      return { label: "Flagged", tone: "bad" };
    case "RATE_TO_AGREE":
      return { label: "Rate to agree", tone: "gold" };
  }
}

export function DealChip({
  service,
  status,
  label: override,
}: {
  service: DealService;
  status: DealStatus;
  label?: string; // e.g. "Payout due" on the crypto detail page
}) {
  const { label: base, tone } = teamStatusLabel(service, status);
  const label = override ?? base;
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold whitespace-nowrap",
        CHIP[tone],
      )}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
      {label}
    </span>
  );
}

const AVATAR = ["bg-accent-primary", "bg-bank-mark-3", "bg-bank-mark-4"];

export function OwnerAvatar({
  owner,
  size = 30,
}: {
  owner: { name: string; initial: string; index: number } | null;
  size?: number;
}) {
  return (
    <span
      title={owner ? owner.name : "Unassigned"}
      aria-label={owner ? `Owner: ${owner.name}` : "No owner"}
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-[12.5px] font-bold",
        owner
          ? `${AVATAR[owner.index % AVATAR.length]} text-white`
          : "bg-border-subtle text-text-muted",
      )}
      style={{ width: size, height: size }}
    >
      {owner ? owner.initial : "–"}
    </span>
  );
}

// deal-detail*.html panels: a titled card and a key/value list.
export function Panel({
  title,
  aside,
  children,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-panel border border-border-default bg-bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <h2 className="text-[16px] font-bold">{title}</h2>
        {aside}
      </div>
      <div className="px-5 py-[18px]">{children}</div>
    </section>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[14.5px] sheet:grid-cols-[150px_1fr] sheet:gap-y-2.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-secondary">{k}</dt>
          <dd className="mb-2.5 min-w-0 font-semibold break-words sheet:mb-0">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
