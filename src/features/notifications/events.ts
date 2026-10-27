// The team alerts and their notification payloads. Lock screens are
// public: a payload carries only the deal ref, the service, the amount and
// what happened, never a customer's name, number, email or account number.
// Each builder takes exactly the fields it may use (so a whole deal row
// can't leak into one); events.test.ts feeds them rows with personal data
// and checks none of it comes out.
import { dealAmountText } from "@/features/deals/format";
import { SERVICE_LABELS } from "@/features/deals/services";
import type { DealService } from "@/generated/prisma/enums";

// The alerts, named as the NotificationPreference switches.
export const TEAM_EVENTS = [
  "newDeal",
  "customerPaid",
  "cryptoDepositComplete",
  "payoutOverdue",
  "whatsappHandover",
  "dealCancelled",
] as const;
export type TeamEvent = (typeof TEAM_EVENTS)[number];

// Settings → Notifications. `dealCancelled` stays hidden until customers
// can cancel a deal themselves (only the team can today).
export const EVENT_SWITCHES: {
  key: TeamEvent;
  label: string;
  hint: string;
  shown: boolean;
}[] = [
  {
    key: "newDeal",
    label: "New deals",
    hint: "A customer sends a deal from the website.",
    shown: true,
  },
  {
    key: "customerPaid",
    label: "Payments to confirm",
    hint: "A customer taps “I’ve paid”.",
    shown: true,
  },
  {
    key: "cryptoDepositComplete",
    label: "Crypto deposits complete",
    hint: "A deposit is confirmed: the payout clock starts.",
    shown: true,
  },
  {
    key: "payoutOverdue",
    label: "Payouts overdue",
    hint: "A crypto payout passed its target time.",
    shown: true,
  },
  {
    key: "whatsappHandover",
    label: "WhatsApp: a customer wants a person",
    hint: "Someone taps “Talk to a person” in the bot.",
    shown: true,
  },
  {
    key: "dealCancelled",
    label: "Deals cancelled by the customer",
    hint: "A customer cancels their deal.",
    shown: false,
  },
];

export const DEFAULT_PREFERENCES: Record<TeamEvent, boolean> = {
  newDeal: true,
  customerPaid: true,
  cryptoDepositComplete: true,
  payoutOverdue: true,
  whatsappHandover: true,
  dealCancelled: false,
};

export type PushPayload = {
  title: string;
  body: string;
  url: string; // a path on our site
  tag: string; // the deal ref: a newer alert for it replaces the old one
};

// Only these fields of a deal ever reach a payload.
type DealFacts = {
  ref: string;
  service: DealService;
  amount: string;
  currency: string;
};

const dealUrl = (ref: string) => `/admin/deals/${ref}`;
const what = (d: DealFacts) =>
  `${SERVICE_LABELS[d.service]} · ${dealAmountText(d.service, d.amount, d.currency)}`;

export function newDealPayload({
  ref,
  service,
  amount,
  currency,
}: DealFacts): PushPayload {
  return {
    title: `New deal · ${ref}`,
    body: `${what({ ref, service, amount, currency })}. Tap to open`,
    url: dealUrl(ref),
    tag: ref,
  };
}

export function customerPaidPayload({ ref }: { ref: string }): PushPayload {
  return {
    title: `Payment to confirm · ${ref}`,
    body: "Customer marked as paid",
    url: dealUrl(ref),
    tag: ref,
  };
}

// `coins`: "500 USDT". `rateToAgree`: BTC that confirmed below the payout.
export function depositCompletePayload({
  ref,
  coins,
  rateToAgree,
}: {
  ref: string;
  coins: string;
  rateToAgree: boolean;
}): PushPayload {
  return rateToAgree
    ? {
        title: `Rate to agree · ${ref}`,
        body: `${coins} received. Agree the final amount`,
        url: dealUrl(ref),
        tag: ref,
      }
    : {
        title: `Deposit complete · ${ref}`,
        body: `${coins} received. Payout clock started`,
        url: dealUrl(ref),
        tag: ref,
      };
}

export function payoutOverduePayload({
  ref,
  dueAt,
  now,
}: {
  ref: string;
  dueAt: Date;
  now: Date;
}): PushPayload {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - dueAt.getTime()) / 60_000),
  );
  return {
    title: `Payout overdue · ${ref}`,
    body:
      minutes < 1
        ? "Due just now"
        : minutes < 120
          ? `Due ${minutes} min ago`
          : `Due ${Math.round(minutes / 60)} h ago`,
    url: dealUrl(ref),
    tag: ref,
  };
}

// No deal and no number: just that someone is waiting.
export function whatsappHandoverPayload(): PushPayload {
  return {
    title: "WhatsApp · a customer wants a person",
    body: "Tap to open WhatsApp and reply",
    url: "/admin/deals",
    tag: "whatsapp-handover",
  };
}

export function dealCancelledPayload({ ref }: { ref: string }): PushPayload {
  return {
    title: `Deal cancelled · ${ref}`,
    body: "The customer cancelled this deal",
    url: dealUrl(ref),
    tag: ref,
  };
}

export const TEST_PAYLOAD: PushPayload = {
  title: "Test notification",
  body: "Notifications are on for this device.",
  url: "/admin/settings/notifications",
  tag: "test",
};
