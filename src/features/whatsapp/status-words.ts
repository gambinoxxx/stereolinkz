// A deal's status in plain words for the WhatsApp bot. Generic on purpose:
// the bot never names a coin or crypto.
import type { DealStatus } from "@/generated/prisma/enums";

export const STATUS_WORDS: Record<DealStatus, string> = {
  NEW: "Received, a team member will contact you",
  AGREED: "Rate agreed",
  AWAITING_PAYMENT: "Waiting for your payment",
  PAYMENT_RECEIVED: "Payment received",
  PROCESSING: "Being processed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  AWAITING_DEPOSIT: "Waiting for your payment",
  DEPOSIT_SEEN: "Payment received, being confirmed",
  DEPOSIT_COMPLETE: "Payment received, paying you out",
  RATE_TO_AGREE: "Being processed, our team will message you",
  PAID_OUT: "Completed",
  EXPIRED: "Expired, message us to start again",
  FLAGGED: "Being checked by our team",
};
