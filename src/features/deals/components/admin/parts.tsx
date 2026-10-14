// Small pieces of deals.html / deal-detail.html shared by the queue and
// the detail page. No hooks: usable from server and client components.
import { Banknote, FileText, Globe2, GraduationCap } from "lucide-react";

import { processingLabel } from "@/features/deals/progress";
import type { DealService, DealStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ICON: Record<DealService, { Icon: typeof GraduationCap; bg: string }> = {
  SCHOOL_FEES: { Icon: GraduationCap, bg: "bg-accent-primary" },
  INTL_PAYMENT: { Icon: Globe2, bg: "bg-deal-pay" },
  POF: { Icon: FileText, bg: "bg-bank-mark-3" },
  FOREX_SELL: { Icon: Banknote, bg: "bg-bg-sidebar" },
  FOREX_BUY: { Icon: Banknote, bg: "bg-bg-sidebar" },
  CRYPTO_SELL: { Icon: Banknote, bg: "bg-bank-mark-4" },
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
    default:
      return { label: status, tone: "off" };
  }
}

export function DealChip({
  service,
  status,
}: {
  service: DealService;
  status: DealStatus;
}) {
  const { label, tone } = teamStatusLabel(service, status);
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
