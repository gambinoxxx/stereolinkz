import "server-only";

// Emails after a deal is created or the customer says they've paid. Called
// with after(): the transaction has committed and the customer already has
// their answer, so a slow or failed email never touches the deal. Each send
// is logged as a SYSTEM event (no addresses stored).
import {
  customerLinkEmail,
  teamNewDealEmail,
  teamPaidEmail,
} from "@/features/deals/emails";
import {
  amountToPayText,
  dealAmountText,
  nairaText,
} from "@/features/deals/format";
import { SERVICE_LABELS } from "@/features/deals/services";
import { db } from "@/lib/server/db";
import {
  alertRecipients,
  customerEmailReady,
  sendEach,
  sendEmail,
} from "@/lib/server/email";
import { siteUrl } from "@/lib/site-url";

async function load(dealId: string) {
  return db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      ref: true,
      service: true,
      amount: true,
      currency: true,
      quotedNaira: true,
      agreedNaira: true,
      customerEmail: true,
      organization: { select: { name: true, dealAlertEmails: true } },
    },
  });
}

async function logSent(dealId: string, message: string, count: number) {
  await db.dealEvent.create({
    data: {
      dealId,
      type: "ALERT_SENT",
      message,
      data: { recipients: count },
      actorType: "SYSTEM",
    },
  });
}

export async function notifyNewDeal(dealId: string, trackingToken: string) {
  try {
    const d = await load(dealId);
    if (!d) return;
    const service = SERVICE_LABELS[d.service];
    const amount = dealAmountText(d.service, d.amount.toString(), d.currency);
    const base = siteUrl();

    const team = alertRecipients();
    if (d.organization.dealAlertEmails && team.length) {
      const sent = await sendEach(
        team,
        teamNewDealEmail({
          ref: d.ref,
          service,
          amount,
          estimate: d.quotedNaira ? nairaText(d.quotedNaira.toString()) : null,
          adminUrl: new URL(`/admin/deals/${d.ref}`, base).href,
        }),
      );
      if (sent)
        await logSent(
          d.id,
          `Team alerted: email sent to ${sent} of ${team.length}`,
          sent,
        );
    }

    if (d.customerEmail && customerEmailReady()) {
      const ok = await sendEmail({
        to: [d.customerEmail],
        ...customerLinkEmail({
          brand: d.organization.name,
          ref: d.ref,
          service,
          amount,
          trackUrl: new URL(
            `/deal/${d.ref}?t=${encodeURIComponent(trackingToken)}`,
            base,
          ).href,
        }),
      });
      if (ok) await logSent(d.id, "Deal link emailed to the customer", 1);
    }
  } catch (error) {
    console.error(
      `[notifyNewDeal] failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}

export async function notifyCustomerPaid(dealId: string) {
  try {
    const d = await load(dealId);
    const team = alertRecipients();
    if (!d || !d.organization.dealAlertEmails || !team.length) return;
    const sent = await sendEach(
      team,
      teamPaidEmail({
        ref: d.ref,
        service: SERVICE_LABELS[d.service],
        amount: dealAmountText(d.service, d.amount.toString(), d.currency),
        toPay: amountToPayText(
          d.service,
          d.amount.toString(),
          d.currency,
          d.agreedNaira?.toString() ?? null,
        ),
        adminUrl: new URL(`/admin/deals/${d.ref}`, siteUrl()).href,
      }),
    );
    if (sent)
      await logSent(
        d.id,
        `Team alerted: customer says they’ve paid (email to ${sent} of ${team.length})`,
        sent,
      );
  } catch (error) {
    console.error(
      `[notifyCustomerPaid] failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}

// Placeholder until the Alerts part: the badge and dashboard already show
// deposit-complete deals; the team email is added there.
export async function notifyDepositComplete(dealId: string) {
  void dealId;
}
