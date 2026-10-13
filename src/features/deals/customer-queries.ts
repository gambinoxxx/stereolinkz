import "server-only";

// The customer's view of one deal (Invariant 14). Called only after the
// tracking token matched (findDealIdByToken). Customer-safe fields only:
// no phone, email, hashes, internal notes, staff ids or payout details;
// our payment account only while the deal awaits the customer's payment.
import { dealDetailsV1 } from "@/features/deals/schema";
import type { DealService, DealStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/server/db";
import { getUserDisplayName } from "@/lib/server/users";

export type CustomerDeal = {
  ref: string;
  service: DealService;
  status: DealStatus;
  customerName: string;
  hasEmail: boolean;
  currency: string;
  amount: string;
  details: ReturnType<typeof dealDetailsV1.parse> | null;
  quote: { rate: string; naira: string; at: string } | null;
  agreed: {
    rate: string | null;
    feeNaira: string | null;
    naira: string | null;
    at: string | null;
    by: string | null;
  } | null;
  payTo: { bank: string; accountNumber: string; accountName: string } | null;
  contactName: string | null;
  createdAt: string;
  changes: { toStatus: DealStatus | null; at: string }[];
  customerPaidAt: string | null; // "I’ve paid" since the payment details were shared
  files: { id: string; name: string; kind: string }[];
};

const firstName = async (clerkUserId: string | null | undefined) =>
  clerkUserId
    ? ((await getUserDisplayName(clerkUserId)).split(/\s+/)[0] ?? null)
    : null;

export async function getDealForCustomer(
  dealId: string,
): Promise<CustomerDeal | null> {
  const d = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      ref: true,
      service: true,
      status: true,
      customerName: true,
      customerEmail: true,
      currency: true,
      amount: true,
      details: true,
      quotedRate: true,
      quotedNaira: true,
      quotedAt: true,
      agreedRate: true,
      feeNaira: true,
      agreedNaira: true,
      agreedAt: true,
      createdAt: true,
      statusChangedAt: true,
      agreedBy: { select: { clerkUserId: true } },
      owner: { select: { clerkUserId: true } },
      paymentAccount: {
        select: { bank: true, accountNumber: true, accountName: true },
      },
      // Only status changes and the customer's own "I’ve paid": never NOTE.
      events: {
        where: { type: { in: ["STATUS_CHANGED", "CUSTOMER_PAID"] } },
        orderBy: { createdAt: "asc" },
        select: { type: true, toStatus: true, createdAt: true },
      },
      files: {
        orderBy: { createdAt: "asc" },
        select: { id: true, originalName: true, kind: true },
      },
    },
  });
  if (!d) return null;

  const details = dealDetailsV1.safeParse(d.details);
  const awaiting = d.status === "AWAITING_PAYMENT";
  const paidEvent = [...d.events]
    .reverse()
    .find((e) => e.type === "CUSTOMER_PAID");
  const [agreedBy, contact] = await Promise.all([
    firstName(d.agreedBy?.clerkUserId),
    firstName(d.owner?.clerkUserId),
  ]);

  return {
    ref: d.ref,
    service: d.service,
    status: d.status,
    customerName: d.customerName,
    hasEmail: !!d.customerEmail,
    currency: d.currency,
    amount: d.amount.toString(),
    details: details.success ? details.data : null,
    quote:
      d.quotedRate && d.quotedNaira && d.quotedAt
        ? {
            rate: d.quotedRate.toString(),
            naira: d.quotedNaira.toString(),
            at: d.quotedAt.toISOString(),
          }
        : null,
    agreed: d.agreedRate
      ? {
          rate: d.agreedRate.toString(),
          feeNaira: d.feeNaira?.toString() ?? null,
          naira: d.agreedNaira?.toString() ?? null,
          at: d.agreedAt?.toISOString() ?? null,
          by: agreedBy,
        }
      : null,
    payTo: awaiting && d.paymentAccount ? d.paymentAccount : null,
    contactName: contact,
    createdAt: d.createdAt.toISOString(),
    changes: d.events
      .filter((e) => e.type === "STATUS_CHANGED")
      .map((e) => ({ toStatus: e.toStatus, at: e.createdAt.toISOString() })),
    // A deal reaches AWAITING_PAYMENT once (the state machine never goes
    // back), so any "I’ve paid" belongs to this payment; no clock compare.
    customerPaidAt:
      awaiting && paidEvent ? paidEvent.createdAt.toISOString() : null,
    files: d.files.map((f) => ({
      id: f.id,
      name: f.originalName,
      kind: f.kind,
    })),
  };
}
