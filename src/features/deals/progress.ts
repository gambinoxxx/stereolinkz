// The deal's progress, as the customer and the team see it. Pure: steps
// come from the status and the times of the STATUS_CHANGED events.
import type { DealService, DealStatus } from "@/generated/prisma/enums";

export type StepState = "done" | "now" | "todo";

const ORDER = [
  "NEW",
  "AGREED",
  "AWAITING_PAYMENT",
  "PAYMENT_RECEIVED",
  "PROCESSING",
  "COMPLETED",
] as const;
export type StepStatus = (typeof ORDER)[number];
const isStep = (s: DealStatus | null): s is StepStatus =>
  !!s && (ORDER as readonly string[]).includes(s);

export type Step = {
  status: StepStatus;
  label: string;
  at: Date | null;
  state: StepState;
};

// Step 5 differs by service.
export function processingLabel(service: DealService): string {
  switch (service) {
    case "SCHOOL_FEES":
      return "Sent to the school";
    case "INTL_PAYMENT":
      return "Sent to the recipient";
    case "POF":
      return "Statement being arranged";
    case "FOREX_SELL":
      return "Paid to your account";
    default:
      return "Sent to your account";
  }
}

export const CUSTOMER_LABELS: Record<StepStatus, string> = {
  NEW: "Requested",
  AGREED: "Rate agreed",
  AWAITING_PAYMENT: "Awaiting your payment",
  PAYMENT_RECEIVED: "Payment received",
  PROCESSING: "Sent",
  COMPLETED: "Completed",
};
export const TEAM_LABELS: Record<StepStatus, string> = {
  NEW: "Requested",
  AGREED: "Agreed",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_RECEIVED: "Payment received",
  PROCESSING: "Sent",
  COMPLETED: "Completed",
};

// Steps up to the deal's status are done, its own step is current; a
// completed deal is done throughout (PROCESSING may have been skipped); a
// cancelled deal keeps the steps it reached and has no current step.
export function dealSteps(
  service: DealService,
  status: DealStatus,
  createdAt: Date,
  changes: { toStatus: DealStatus | null; at: Date }[],
  labels: Record<StepStatus, string> = CUSTOMER_LABELS,
): Step[] {
  const cancelled = status === "CANCELLED";
  let reached: StepStatus = "NEW";
  if (cancelled) {
    for (const c of changes) if (isStep(c.toStatus)) reached = c.toStatus;
  } else if (isStep(status)) reached = status;
  const index = ORDER.indexOf(reached);

  return ORDER.map((s, i) => {
    const at =
      s === "NEW"
        ? createdAt
        : ([...changes].reverse().find((c) => c.toStatus === s)?.at ?? null);
    const state: StepState =
      status === "COMPLETED" || i < index || (cancelled && i === index)
        ? "done"
        : i === index
          ? "now"
          : "todo";
    return {
      status: s,
      label: s === "PROCESSING" ? processingLabel(service) : labels[s],
      at,
      state,
    };
  });
}

export type Tone = "vio" | "gold" | "ok" | "off";

// The chip on the customer's page.
export function customerStatus(
  service: DealService,
  status: DealStatus,
): { label: string; tone: Tone } {
  switch (status) {
    case "NEW":
      return { label: "Requested", tone: "vio" };
    case "AGREED":
      return { label: "Rate agreed", tone: "vio" };
    case "AWAITING_PAYMENT":
      return { label: "Awaiting your payment", tone: "gold" };
    case "PAYMENT_RECEIVED":
      return { label: "Payment received", tone: "ok" };
    case "PROCESSING":
      return { label: processingLabel(service), tone: "vio" };
    case "COMPLETED":
      return { label: "Completed", tone: "ok" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "off" };
    // Crypto (Phase 13). FLAGGED never shows its reason to the customer.
    case "AWAITING_DEPOSIT":
      return { label: "Waiting for your deposit", tone: "vio" };
    case "DEPOSIT_SEEN":
      return { label: "Deposit seen", tone: "vio" };
    case "DEPOSIT_COMPLETE":
      return { label: "Deposit complete", tone: "ok" };
    case "PAID_OUT":
      return { label: "Paid out", tone: "ok" };
    case "EXPIRED":
      return { label: "Rate lock ended", tone: "gold" };
    case "FLAGGED":
      return { label: "Being checked", tone: "gold" };
    case "RATE_TO_AGREE":
      return { label: "Coins received", tone: "ok" };
  }
}
