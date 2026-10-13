// Copy and option lists for the customer deal pages (docs/design/deal-*).
// Countries are plain choices (not rows); currency and bank names always
// come from the latest boards (Invariant 1).
import type {
  INTL_PURPOSES,
  POF_PURPOSES,
  RECEIVE_METHODS,
  SCHOOL_PURPOSES,
} from "@/features/deals/schema";
import type { FormSlug } from "@/features/deals/services";

export const SCHOOL_COUNTRIES = [
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "Ireland",
  "Australia",
  "Other",
];
export const PAY_COUNTRIES = [
  "China",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "Other",
];

export const SCHOOL_PURPOSE_LABELS: Record<
  (typeof SCHOOL_PURPOSES)[number],
  string
> = {
  TUITION: "Tuition",
  DEPOSIT: "Deposit",
  ACCOMMODATION: "Accommodation",
  APPLICATION: "Application fee",
};
export const INTL_PURPOSE_LABELS: Record<
  (typeof INTL_PURPOSES)[number],
  string
> = {
  SUPPLIER: "Supplier",
  RENT: "Rent",
  BILLS: "Bills or fees",
  FAMILY: "Family",
  OTHER: "Other",
};
export const RECEIVE_METHOD_LABELS: Record<
  (typeof RECEIVE_METHODS)[number],
  string
> = {
  WIRE: "Wire transfer",
  ACH: "ACH (US)",
  LOCAL: "Local bank transfer",
  NOT_SURE: "Not sure, advise me",
};
export const POF_PURPOSE_LABELS: Record<(typeof POF_PURPOSES)[number], string> =
  {
    STUDY_VISA: "Study visa",
    VISIT_VISA: "Visit visa",
    SCHOOL_ADMISSION: "School admission",
    OTHER: "Other",
  };

export const DEAL_COPY = {
  footer: "Rates are indicative until confirmed by our team on WhatsApp.",
  start: {
    crumb: "Deal desk",
    title: "What can we do for you today?",
    lead: "Pick a service, see your estimate from today’s rates, then confirm with our team on WhatsApp. No account needed.",
    closed: "Online deals aren’t open yet",
    closedSub:
      "Message us on WhatsApp and our team will help you straight away.",
    how: [
      {
        title: "Tell us the details",
        body: "Takes about a minute. You see an estimate straight away.",
      },
      {
        title: "Confirm on WhatsApp",
        body: "Our team agrees the final rate with you, quoting your deal number.",
      },
      {
        title: "Track it here",
        body: "Follow every step on your private deal page until it’s done.",
      },
    ],
    cash: "Cash is arranged on request for existing customers.",
  },
  cards: {
    "school-fees": {
      title: "School fees abroad",
      body: "Tuition, deposits and accommodation paid straight to the school.",
    },
    "pay-abroad": {
      title: "International payment",
      body: "Suppliers, rent and bills in the UK, US, Europe, Canada, China and more.",
    },
    pof: {
      title: "Proof of funds",
      body: "Bank statements for visa, school and travel applications.",
    },
    forex: {
      title: "Sell or buy forex",
      body: "Send foreign currency from your banking app, or buy from us.",
    },
  } satisfies Record<FormSlug, { title: string; body: string }>,
  forms: {
    "school-fees": {
      title: "School fees abroad",
      lead: "We pay the school directly and send you the confirmation. Upload the invoice so we can check the details.",
    },
    "pay-abroad": {
      title: "International payment",
      lead: "Pay suppliers, rent or bills abroad. You pay in naira; they receive in their currency, usually the same day.",
    },
    pof: {
      title: "Proof of funds",
      lead: "A bank statement showing the funds you need for your visa, school or travel application.",
    },
    forex: {
      title: "Sell or buy forex",
      lead: "Send foreign currency from your banking app and receive naira, or buy foreign currency from us.",
    },
  } satisfies Record<FormSlug, { title: string; lead: string }>,
  noQuote: "We’ll quote on WhatsApp",
  fine: "Your final rate is confirmed on WhatsApp before you pay anything.",
};
