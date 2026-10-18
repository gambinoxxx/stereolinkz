// Deal desk emails. Pure: the server fills in the values. Team alerts
// carry the reference, service, amount and the admin link only: never the
// customer's phone number, email or files.
import type { Email } from "@/lib/server/email";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function layout(lines: string[], link: { href: string; label: string }) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1F0B3F">${lines
    .map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`)
    .join(
      "",
    )}<p style="margin:18px 0 0"><a href="${esc(link.href)}" style="background:#6A35D9;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold">${esc(link.label)}</a></p></div>`;
}

type DealLine = {
  ref: string;
  service: string;
  amount: string;
  estimate: string | null;
  adminUrl: string;
};

export function teamNewDealEmail(d: DealLine): Omit<Email, "to"> {
  const lines = [
    `New deal ${d.ref}: ${d.service}, ${d.amount}.`,
    d.estimate
      ? `Website estimate: ${d.estimate}.`
      : "No estimate (currency or bank not on the latest board).",
    "Open it to contact the customer on WhatsApp.",
  ];
  return {
    subject: `New deal ${d.ref} · ${d.service}`,
    text: `${lines.join("\n")}\n\n${d.adminUrl}`,
    html: layout(lines, { href: d.adminUrl, label: `Open ${d.ref}` }),
  };
}

export function teamPaidEmail(
  d: Omit<DealLine, "estimate"> & { toPay: string | null },
): Omit<Email, "to"> {
  const lines = [
    `The customer on ${d.ref} (${d.service}, ${d.amount}) says they’ve paid${d.toPay ? ` ${d.toPay}` : ""}.`,
    "Check the bank statement before marking the payment received.",
  ];
  return {
    subject: `${d.ref}: customer says they’ve paid`,
    text: `${lines.join("\n")}\n\n${d.adminUrl}`,
    html: layout(lines, { href: d.adminUrl, label: `Open ${d.ref}` }),
  };
}

export function customerLinkEmail(d: {
  brand: string;
  ref: string;
  service: string;
  amount: string;
  trackUrl: string;
}): Omit<Email, "to"> {
  const lines = [
    `Thanks for your request. Your deal number is ${d.ref} (${d.service}, ${d.amount}).`,
    "Follow your deal on your private page. Anyone with this link can see its status, so keep it to yourself.",
    `Our team confirms the final rate with you on WhatsApp before you pay anything.`,
  ];
  return {
    subject: `Your deal ${d.ref} with ${d.brand}`,
    text: `${lines.join("\n")}\n\n${d.trackUrl}`,
    html: layout(lines, { href: d.trackUrl, label: "Open my deal page" }),
  };
}

// Crypto (Phase 13). Team emails carry the ref, the amount and the admin
// link only.
export function teamDepositCompleteEmail(d: {
  ref: string;
  amount: string; // "500.37 USDT"
  payout: string; // "₦795,000"
  minutes: number;
  adminUrl: string;
}): Omit<Email, "to"> {
  const lines = [
    `Deposit complete on ${d.ref}: ${d.amount}.`,
    `Pay out ${d.payout} within ${d.minutes} minutes, then mark it paid out with the bank reference.`,
  ];
  return {
    subject: `${d.ref}: payout due (${d.payout})`,
    text: `${lines.join("\n")}\n\n${d.adminUrl}`,
    html: layout(lines, { href: d.adminUrl, label: `Open ${d.ref}` }),
  };
}

export function teamPayoutOverdueEmail(d: {
  ref: string;
  amount: string;
  payout: string;
  adminUrl: string;
}): Omit<Email, "to"> {
  const lines = [
    `The payout on ${d.ref} (${d.amount}, ${d.payout}) is past its target.`,
    "The customer’s page now says it’s taking a little longer. Pay out and mark it paid out.",
  ];
  return {
    subject: `${d.ref}: payout overdue`,
    text: `${lines.join("\n")}\n\n${d.adminUrl}`,
    html: layout(lines, { href: d.adminUrl, label: `Open ${d.ref}` }),
  };
}

// The customer's receipt. No deal link: only the link token's hash is
// stored, so the email can't rebuild it.
export function customerPaidOutEmail(d: {
  brand: string;
  ref: string;
  payout: string;
  account: string; // "Opay ••4567"
  reference: string;
}): Omit<Email, "to"> {
  const lines = [
    `${d.payout} has been sent to your ${d.account} for deal ${d.ref}.`,
    `Bank reference: ${d.reference}.`,
    `Thank you for choosing ${d.brand}.`,
  ];
  return {
    subject: `${d.ref}: ${d.payout} sent`,
    text: lines.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1F0B3F">${lines
      .map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`)
      .join("")}</div>`,
  };
}

export function teamRateToAgreeEmail(d: {
  ref: string;
  amount: string;
  adminUrl: string;
}): Omit<Email, "to"> {
  const lines = [
    `Coins received on ${d.ref}: ${d.amount}, but the price moved past the margin while they confirmed.`,
    "Agree the payout with the customer on WhatsApp, then record it to start the payout timer.",
  ];
  return {
    subject: `${d.ref}: coins received, rate to agree`,
    text: `${lines.join("\n")}\n\n${d.adminUrl}`,
    html: layout(lines, { href: d.adminUrl, label: `Open ${d.ref}` }),
  };
}
