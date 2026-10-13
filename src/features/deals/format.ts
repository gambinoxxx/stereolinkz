// Display helpers for deal amounts. Exact values stay strings; naira is
// shown in whole naira (rounded half up), as on the landing page.
import { estimateNaira } from "@/features/public/estimate";
import type { DealService } from "@/generated/prisma/enums";
import { formatRate } from "@/lib/format";

// "8282250.5" → "₦8,282,251"
export function nairaText(exact: string): string {
  return `₦${formatRate(estimateNaira(exact, "1") ?? "0")}`;
}

// The deal's own amount: "4,500 GBP", or "₦15,000,000" for POF.
export function dealAmountText(
  service: DealService,
  amount: string,
  currency: string,
): string {
  return service === "POF" || currency === "NGN"
    ? nairaText(amount)
    : `${formatRate(amount)} ${currency}`;
}

// The rate as people read it: "₦1,840 per GBP", or "3.4% per month".
export function rateText(
  service: DealService,
  rate: string,
  currency: string,
): string {
  return service === "POF"
    ? `${formatRate(rate)}% per month`
    : `₦${formatRate(rate)} per ${currency}`;
}

// What the customer sends us: selling forex they send the foreign amount;
// everything else they pay in naira (the agreed amount).
export function amountToPayText(
  service: DealService,
  amount: string,
  currency: string,
  agreedNaira: string | null,
): string | null {
  if (service === "FOREX_SELL")
    return dealAmountText(service, amount, currency);
  return agreedNaira ? nairaText(agreedNaira) : null;
}
