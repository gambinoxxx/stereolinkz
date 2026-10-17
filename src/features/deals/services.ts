// The deal services (DealService), their website slugs and labels. Pure
// and client-safe. CRYPTO_SELL is in the enum for Phase 13 and is never
// offered by Phase 12 code.
import type { DealService } from "@/generated/prisma/enums";

export type { DealService };

// Services a customer can start in Phase 12. FOREX_SELL and FOREX_BUY
// share one form (/deal/new/forex) with a sell/buy toggle.
export const PHASE12_SERVICES = [
  "SCHOOL_FEES",
  "INTL_PAYMENT",
  "POF",
  "FOREX_SELL",
  "FOREX_BUY",
] as const satisfies readonly DealService[];
export type Phase12Service = (typeof PHASE12_SERVICES)[number];

// Every service Settings → Deal desk can switch on (crypto: Phase 13).
export const DESK_SERVICES = [
  ...PHASE12_SERVICES,
  "CRYPTO_SELL",
] as const satisfies readonly DealService[];
export type DeskService = (typeof DESK_SERVICES)[number];

// How a payment account's use reads in Settings: for crypto we pay out.
export const ACCOUNT_SERVICE_LABELS: Record<DeskService, string> = {
  SCHOOL_FEES: "School fees",
  INTL_PAYMENT: "International payment",
  POF: "Proof of funds",
  FOREX_SELL: "Sell forex",
  FOREX_BUY: "Buy forex",
  CRYPTO_SELL: "Crypto payouts",
};

export const FORM_SLUGS = [
  "school-fees",
  "pay-abroad",
  "pof",
  "forex",
] as const;
export type FormSlug = (typeof FORM_SLUGS)[number];

// The services each form can create.
export const FORM_SERVICES: Record<FormSlug, readonly Phase12Service[]> = {
  "school-fees": ["SCHOOL_FEES"],
  "pay-abroad": ["INTL_PAYMENT"],
  pof: ["POF"],
  forex: ["FOREX_SELL", "FOREX_BUY"],
};

export function formSlugFor(service: DealService): FormSlug | null {
  for (const slug of FORM_SLUGS)
    if ((FORM_SERVICES[slug] as readonly DealService[]).includes(service))
      return slug;
  return null;
}

export function isFormSlug(value: string): value is FormSlug {
  return (FORM_SLUGS as readonly string[]).includes(value);
}

export const SERVICE_LABELS: Record<DealService, string> = {
  SCHOOL_FEES: "School fees",
  INTL_PAYMENT: "International payment",
  POF: "Proof of funds",
  FOREX_SELL: "Sell forex",
  FOREX_BUY: "Buy forex",
  CRYPTO_SELL: "Sell crypto",
};

// Settings → Deal desk lists the forex pair as one switch, as the design does.
export const SETTINGS_SERVICES: {
  key: string;
  label: string;
  services: DealService[];
}[] = [
  {
    key: "school-fees",
    label: "School fees abroad",
    services: ["SCHOOL_FEES"],
  },
  {
    key: "pay-abroad",
    label: "International payment",
    services: ["INTL_PAYMENT"],
  },
  { key: "pof", label: "Proof of funds", services: ["POF"] },
  {
    key: "forex",
    label: "Sell or buy forex (transfer)",
    services: ["FOREX_SELL", "FOREX_BUY"],
  },
  { key: "crypto", label: "Sell crypto", services: ["CRYPTO_SELL"] },
];

// A form is open when any of its services is enabled.
export function isFormEnabled(slug: FormSlug, enabled: readonly DealService[]) {
  return FORM_SERVICES[slug].some((s) => enabled.includes(s));
}
