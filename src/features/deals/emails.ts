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
