// WhatsApp messages for the deal desk, written once here. Customer-side
// hand-offs (to our number) and the team's ready-made texts per status (to
// the customer). Amounts come from the deal; nothing is invented.
import {
  amountToPayText,
  dealAmountText,
  nairaText,
  rateText,
} from "@/features/deals/format";
import { SERVICE_LABELS } from "@/features/deals/services";
import type { DealService, DealStatus } from "@/generated/prisma/enums";

type DealRef = {
  ref: string;
  service: DealService;
  amount: string;
  currency: string;
};

// "Hi Stereolinkz, my deal number is SLZ-1047 (school fees, 4,500 GBP)."
export function continueMessage(brand: string, deal: DealRef): string {
  return `Hi ${brand}, my deal number is ${deal.ref} (${SERVICE_LABELS[deal.service].toLowerCase()}, ${dealAmountText(deal.service, deal.amount, deal.currency)}).`;
}

export function aboutDealMessage(brand: string, ref: string): string {
  return `Hi ${brand}, about my deal ${ref}`;
}

export function paidMessage(brand: string, ref: string): string {
  return `Hi ${brand}, I’ve paid for ${ref}. Here is my receipt.`;
}

export type TeamMessage = { label: string; text: string };

type TeamDeal = DealRef & {
  status: DealStatus;
  customerName: string;
  agreedRate: string | null;
  agreedNaira: string | null;
  account: { bank: string; accountNumber: string; accountName: string } | null;
  trackUrl: string | null; // the customer's own link, if the rep has it (never stored)
};

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// The texts the WhatsApp panel offers for the deal's current status.
export function teamMessages(d: TeamDeal): TeamMessage[] {
  const hi = `Hi ${first(d.customerName)}`;
  const amount = dealAmountText(d.service, d.amount, d.currency);
  const pay = amountToPayText(d.service, d.amount, d.currency, d.agreedNaira);
  const out: TeamMessage[] = [];
  switch (d.status) {
    case "NEW":
      out.push({
        label: "Confirm the rate",
        text: `${hi}, thanks for your request ${d.ref} (${SERVICE_LABELS[d.service].toLowerCase()}, ${amount}). Let’s confirm today’s rate for you.`,
      });
      break;
    case "AGREED":
      out.push({
        label: "Confirm what we agreed",
        text: `${hi}, for ${d.ref} we agreed ${d.agreedRate ? rateText(d.service, d.agreedRate, d.currency) : "the rate"}${d.agreedNaira ? `, ${nairaText(d.agreedNaira)} in total` : ""}. Our payment details will appear on your deal page shortly.`,
      });
      break;
    case "AWAITING_PAYMENT":
      if (d.account && pay)
        out.push({
          label: "Send payment details",
          text: `${hi}, for ${d.ref} please pay ${pay} to ${d.account.bank}, ${d.account.accountNumber}, ${d.account.accountName}. Use ${d.ref} as the narration. Only pay into the account on your deal page.`,
        });
      out.push({
        label: "Ask for the receipt",
        text: `Please send your transfer receipt for ${d.ref}.`,
      });
      break;
    case "PAYMENT_RECEIVED":
      out.push({
        label: "Confirm we received it",
        text: `${hi}, we’ve received your payment for ${d.ref}. We’re processing it now.`,
      });
      break;
    case "PROCESSING":
      out.push({
        label: "Say it’s on its way",
        text: `${hi}, ${d.ref} has been sent. We’ll share the confirmation as soon as we have it.`,
      });
      break;
    case "COMPLETED":
      out.push({
        label: "Thank the customer",
        text: `${hi}, ${d.ref} is complete. Thank you for choosing us.`,
      });
      break;
    // Crypto (Phase 13): agreedNaira is the payout (the quote until re-quoted).
    case "AWAITING_DEPOSIT":
      out.push({
        label: "Remind them to send",
        text: `${hi}, for ${d.ref} please send exactly ${amount} to the address on your deal page, on the network shown there, before your rate lock ends.`,
      });
      break;
    case "DEPOSIT_SEEN":
      out.push({
        label: "Say we’ve seen it",
        text: `${hi}, we can see your ${amount} for ${d.ref}. It’s confirming on the network now.`,
      });
      break;
    case "DEPOSIT_COMPLETE":
      out.push({
        label: "Tell them it’s being paid",
        text: `${hi}, your ${amount} is confirmed.${d.agreedNaira ? ` ${nairaText(d.agreedNaira)} is on its way to your account.` : " Your naira is on its way."}`,
      });
      break;
    case "PAID_OUT":
      out.push({
        label: "Confirm the payout",
        text: `${hi}, ${d.agreedNaira ? nairaText(d.agreedNaira) : "your naira"} has been sent for ${d.ref}. Thank you for choosing us.`,
      });
      break;
    case "EXPIRED":
      out.push({
        label: "Offer a new rate",
        text: `${hi}, the rate lock for ${d.ref} ended before your deposit arrived. Let’s agree a new rate.`,
      });
      break;
    case "FLAGGED":
      out.push({
        label: "Say we’re checking",
        text: `${hi}, we’re checking the deposit for ${d.ref} and will update you shortly.`,
      });
      break;
    default:
      break;
  }
  if (d.trackUrl)
    out.push({
      label: "Share the deal link",
      text: `${hi}, you can follow ${d.ref} here: ${d.trackUrl}`,
    });
  return out;
}
