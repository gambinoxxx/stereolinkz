import "server-only";

// Alerts after a deal is created or the customer says they've paid, and
// for crypto deposits and payouts. Called with after(): the transaction has
// committed and the customer already has their answer, so a slow or failed
// alert never touches the deal. Team alerts go through alertTeam (email and
// push together); each send is logged as a SYSTEM event (no addresses
// stored).
import {
  customerLinkEmail,
  customerPaidOutEmail,
  teamDepositCompleteEmail,
  teamNewDealEmail,
  teamPaidEmail,
  teamPayoutOverdueEmail,
  teamRateToAgreeEmail,
} from "@/features/deals/emails";
import {
  amountToPayText,
  dealAmountText,
  nairaText,
} from "@/features/deals/format";
import { SERVICE_LABELS } from "@/features/deals/services";
import { alertTeam } from "@/features/notifications/alert";
import {
  customerPaidPayload,
  depositCompletePayload,
  newDealPayload,
  payoutOverduePayload,
} from "@/features/notifications/events";
import { db } from "@/lib/server/db";
import { customerEmailReady, sendEmail } from "@/lib/server/email";
import { siteUrl } from "@/lib/site-url";

async function load(dealId: string) {
  return db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      organizationId: true,
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

    await alertTeam({
      organizationId: d.organizationId,
      event: "newDeal",
      dealId: d.id,
      email: d.organization.dealAlertEmails
        ? teamNewDealEmail({
            ref: d.ref,
            service,
            amount,
            estimate: d.quotedNaira
              ? nairaText(d.quotedNaira.toString())
              : null,
            adminUrl: new URL(`/admin/deals/${d.ref}`, base).href,
          })
        : null,
      push: newDealPayload({
        ref: d.ref,
        service: d.service,
        amount: d.amount.toString(),
        currency: d.currency,
      }),
      label: "Team alerted",
    });

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
    if (!d) return;
    await alertTeam({
      organizationId: d.organizationId,
      event: "customerPaid",
      dealId: d.id,
      email: d.organization.dealAlertEmails
        ? teamPaidEmail({
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
          })
        : null,
      push: customerPaidPayload({ ref: d.ref }),
      label: "Team alerted: customer says they’ve paid",
    });
  } catch (error) {
    console.error(
      `[notifyCustomerPaid] failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}

// ── Crypto (Phase 13) ────────────────────────────────────────────────

async function loadCrypto(dealId: string) {
  return db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      organizationId: true,
      ref: true,
      status: true,
      payoutDueAt: true,
      cryptoTicker: true,
      receivedQty: true,
      expectedQty: true,
      quotedNaira: true,
      agreedNaira: true,
      customerEmail: true,
      payoutBank: true,
      payoutAccountNumber: true,
      payoutReference: true,
      organization: {
        select: {
          name: true,
          payoutAlertEmails: true,
          payoutTargetMinutes: true,
        },
      },
    },
  });
}
type CryptoForEmail = NonNullable<Awaited<ReturnType<typeof loadCrypto>>>;
const coinsText = (d: CryptoForEmail) =>
  `${(d.receivedQty ?? d.expectedQty)?.toFixed() ?? ""} ${d.cryptoTicker ?? ""}`.trim();
const payoutText = (d: CryptoForEmail) =>
  nairaText((d.agreedNaira ?? d.quotedNaira)?.toString() ?? "0");

// Deposit complete: the team pays out against the timer. The badge and
// the dashboard show it anyway; email only when switched on, push to
// whoever wants it.
export async function notifyDepositComplete(dealId: string) {
  try {
    const d = await loadCrypto(dealId);
    if (!d) return;
    const adminUrl = new URL(`/admin/deals/${d.ref}`, siteUrl()).href;
    // BTC whose price moved past the margin: agree first, then pay.
    const toAgree = d.status === "RATE_TO_AGREE";
    await alertTeam({
      organizationId: d.organizationId,
      event: "cryptoDepositComplete",
      dealId: d.id,
      email: !d.organization.payoutAlertEmails
        ? null
        : toAgree
          ? teamRateToAgreeEmail({
              ref: d.ref,
              amount: coinsText(d),
              adminUrl,
            })
          : teamDepositCompleteEmail({
              ref: d.ref,
              amount: coinsText(d),
              payout: payoutText(d),
              minutes: d.organization.payoutTargetMinutes,
              adminUrl,
            }),
      push: depositCompletePayload({
        ref: d.ref,
        coins: coinsText(d),
        rateToAgree: toAgree,
      }),
      label: `Team alerted: ${toAgree ? "rate to agree" : "payout due"}`,
    });
  } catch (error) {
    console.error(
      `[notifyDepositComplete] failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}

// The payout target passed without "paid out": claimed once per deal
// (payoutOverdueAlertAt, set conditionally so two cron runs can't both
// send), logged, emailed when switched on and pushed to whoever wants it.
export async function alertOverduePayouts(now = new Date()) {
  const due = await db.deal.findMany({
    where: {
      status: "DEPOSIT_COMPLETE",
      payoutDueAt: { lt: now },
      payoutOverdueAlertAt: null,
    },
    select: { id: true },
    take: 50,
  });
  let alerted = 0;
  for (const { id } of due) {
    const { count } = await db.deal.updateMany({
      where: { id, status: "DEPOSIT_COMPLETE", payoutOverdueAlertAt: null },
      data: { payoutOverdueAlertAt: now },
    });
    if (count !== 1) continue;
    alerted++;
    try {
      const d = await loadCrypto(id);
      if (!d) continue;
      await alertTeam({
        organizationId: d.organizationId,
        event: "payoutOverdue",
        dealId: d.id,
        email: d.organization.payoutAlertEmails
          ? teamPayoutOverdueEmail({
              ref: d.ref,
              amount: coinsText(d),
              payout: payoutText(d),
              adminUrl: new URL(`/admin/deals/${d.ref}`, siteUrl()).href,
            })
          : null,
        push: payoutOverduePayload({
          ref: d.ref,
          dueAt: d.payoutDueAt ?? now,
          now,
        }),
        label: "Payout overdue: team alerted",
        quietLabel: "Payout overdue: past the payout target",
      });
    } catch (error) {
      console.error(
        `[alertOverduePayouts] failed: ${error instanceof Error ? error.name : "error"}`,
      );
    }
  }
  return alerted;
}

// Paid out: the customer's page updates on its next refresh; if they gave
// an email (and a real sender is set up), they also get the receipt.
export async function notifyPaidOut(dealId: string) {
  try {
    const d = await loadCrypto(dealId);
    if (!d || !d.customerEmail || !d.payoutReference || !customerEmailReady())
      return;
    const ok = await sendEmail({
      to: [d.customerEmail],
      ...customerPaidOutEmail({
        brand: d.organization.name,
        ref: d.ref,
        payout: payoutText(d),
        account: `${d.payoutBank ?? "bank"} ••${(d.payoutAccountNumber ?? "").slice(-4)}`,
        reference: d.payoutReference,
      }),
    });
    if (ok) await logSent(d.id, "Payout receipt emailed to the customer", 1);
  } catch (error) {
    console.error(
      `[notifyPaidOut] failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}
