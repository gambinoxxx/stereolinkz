// Deal desk emails. Pure: the server fills in the values. Team alerts
// carry the reference, service, amount and the admin link only: never the
// customer's phone number, email or files.
//
// Built for email clients: table layout and inline styles only, 600px
// max width, no web fonts or external CSS (Gmail strips them). The logo is
// a PNG (Gmail and Outlook block SVG) served from /email/logo.png.
import type { Email } from "@/lib/server/email";
import { siteUrl } from "@/lib/site-url";

const BRAND = {
  primary: "#6C2BD9",
  primaryDark: "#24124F",
  gold: "#E3B75A",
  ink: "#1A1530",
  muted: "#6B6780",
  line: "#ECE9F3",
  bg: "#F5F3FA",
  card: "#FFFFFF",
  tint: "#F3EEFF",
  warn: "#B4232C",
  warnTint: "#FDECEC",
  ok: "#1E8A4C",
  okTint: "#E6F6EC",
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const lagosTime = (d: Date) =>
  d.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

type Tone = "brand" | "warn" | "ok";
const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: BRAND.primary, bg: BRAND.tint },
  warn: { fg: BRAND.warn, bg: BRAND.warnTint },
  ok: { fg: BRAND.ok, bg: BRAND.okTint },
};

type Shell = {
  preheader: string;
  kicker: string; // top-right of the header: "Deal alert", "Receipt"
  badge: string; // "NEW · SLZ-1047"
  tone?: Tone;
  title: string;
  intro: string;
  hero?: { label: string; value: string; sub?: string };
  rows: [string, string][];
  button?: { href: string; label: string };
  note?: string;
  audience: "team" | "customer";
};

// Every value is escaped here, so callers pass plain text.
function shell(s: Shell): string {
  const site = siteUrl();
  const logo = new URL("/email/logo.png", site).href;
  const tone = TONES[s.tone ?? "brand"];

  const rows = s.rows
    .map(([label, value], i) => {
      const border =
        i === s.rows.length - 1 ? "" : `border-bottom:1px solid ${BRAND.line};`;
      return `<tr>
        <td style="padding:12px 0;${border}font-size:14px;color:${BRAND.muted};">${esc(label)}</td>
        <td align="right" style="padding:12px 0;${border}font-size:14px;color:${BRAND.ink};font-weight:600;">${esc(value)}</td>
      </tr>`;
    })
    .join("");

  const hero = s.hero
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.tint};border-radius:12px;">
        <tr><td style="padding:20px 22px;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${BRAND.muted};font-weight:600;">${esc(s.hero.label)}</div>
          <div style="font-size:32px;line-height:1.2;font-weight:800;color:${BRAND.ink};margin-top:4px;">${esc(s.hero.value)}</div>
          ${s.hero.sub ? `<div style="font-size:14px;color:${BRAND.muted};margin-top:4px;">${esc(s.hero.sub)}</div>` : ""}
        </td></tr>
      </table>`
    : "";

  const button = s.button
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr><td style="padding-top:10px;">
        <a href="${esc(s.button.href)}" style="display:block;padding:15px 20px;border-radius:10px;background:${BRAND.primary};color:#ffffff;font-size:16px;font-weight:700;text-align:center;text-decoration:none;">${esc(s.button.label)}</a>
      </td></tr></table>`
    : "";

  const footer =
    s.audience === "team"
      ? "Internal notification. You're receiving this because you manage Stereolinkz deals."
      : "You're receiving this because you started a deal with Stereolinkz.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(s.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(s.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <tr><td style="background:${BRAND.primaryDark};background-image:linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primary});border-radius:16px 16px 0 0;padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><a href="${esc(site.href)}"><img src="${esc(logo)}" width="249" height="40" alt="Stereolinkz" style="display:block;border:0;height:40px;width:249px;color:#ffffff;font-size:20px;font-weight:700;"></a></td>
            <td align="right" style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${BRAND.gold};font-weight:700;">${esc(s.kicker)}</td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BRAND.card};padding:28px;border-radius:0 0 16px 16px;">
          <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:12px;font-weight:700;">&#9679; ${esc(s.badge)}</span>
          <h1 style="margin:14px 0 4px;font-size:22px;line-height:1.3;color:${BRAND.ink};">${esc(s.title)}</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:${BRAND.muted};">${esc(s.intro)}</p>
          ${hero}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${rows}</table>
          ${button}
          ${s.note ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:${BRAND.muted};">${esc(s.note)}</p>` : ""}
        </td></tr>

        <tr><td align="center" style="padding:20px 12px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
          Stereolinkz &middot; FX &middot; Crypto &middot; International payments<br>
          <a href="${esc(site.href)}" style="color:${BRAND.primary};text-decoration:none;">${esc(site.host)}</a><br>
          ${esc(footer)}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    html: shell({
      preheader: `${d.service}, ${d.amount}${d.estimate ? `: estimate ${d.estimate}` : ""}. Contact the customer on WhatsApp.`,
      kicker: "Deal alert",
      badge: `NEW · ${d.ref}`,
      title: `${d.service} request`,
      intro:
        "A customer just started a deal on the website. Open it to contact them on WhatsApp and confirm the rate.",
      hero: d.estimate
        ? {
            label: "Website estimate",
            value: d.estimate,
            sub: `for ${d.amount}`,
          }
        : {
            label: "Amount",
            value: d.amount,
            sub: "No estimate: currency or bank not on the latest board",
          },
      rows: [
        ["Deal", d.ref],
        ["Service", d.service],
        ["Amount", d.amount],
        ["Received", lagosTime(new Date())],
      ],
      button: { href: d.adminUrl, label: `Open deal ${d.ref}` },
      note: "The estimate uses the website rate when the deal was created. Confirm the final rate with the customer before paying out.",
      audience: "team",
    }),
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
    html: shell({
      preheader: `${d.ref}: the customer says they’ve paid. Check the bank statement.`,
      kicker: "Deal alert",
      badge: `PAID? · ${d.ref}`,
      title: "Customer says they’ve paid",
      intro: `The customer on ${d.ref} marked their payment as sent.`,
      hero: d.toPay
        ? {
            label: "They should have paid",
            value: d.toPay,
            sub: `for ${d.amount}`,
          }
        : undefined,
      rows: [
        ["Deal", d.ref],
        ["Service", d.service],
        ["Amount", d.amount],
      ],
      button: { href: d.adminUrl, label: `Open deal ${d.ref}` },
      note: "Check the bank statement before marking the payment received.",
      audience: "team",
    }),
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
    html: shell({
      preheader: `Your deal number is ${d.ref}. Follow it on your private page.`,
      kicker: "Your deal",
      badge: d.ref,
      title: "Thanks, we’ve got your request",
      intro:
        "Our team confirms the final rate with you on WhatsApp before you pay anything.",
      rows: [
        ["Deal number", d.ref],
        ["Service", d.service],
        ["Amount", d.amount],
      ],
      button: { href: d.trackUrl, label: "Open my deal page" },
      note: "Anyone with this link can see your deal’s status, so keep it to yourself.",
      audience: "customer",
    }),
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
    html: shell({
      preheader: `Deposit complete on ${d.ref}. Pay out ${d.payout} within ${d.minutes} minutes.`,
      kicker: "Payout due",
      badge: `DEPOSIT COMPLETE · ${d.ref}`,
      tone: "ok",
      title: "Deposit complete: pay out now",
      intro: `The customer’s ${d.amount} has arrived and the payout timer has started.`,
      hero: {
        label: "Pay out",
        value: d.payout,
        sub: `within ${d.minutes} minutes`,
      },
      rows: [
        ["Deal", d.ref],
        ["Received", d.amount],
      ],
      button: { href: d.adminUrl, label: `Open deal ${d.ref}` },
      note: "Mark it paid out with the bank reference so the customer’s page updates.",
      audience: "team",
    }),
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
    html: shell({
      preheader: `The payout on ${d.ref} is past its target.`,
      kicker: "Payout overdue",
      badge: `OVERDUE · ${d.ref}`,
      tone: "warn",
      title: "This payout is overdue",
      intro:
        "The customer’s page now says it’s taking a little longer. Pay out and mark it paid out.",
      hero: { label: "Still to pay", value: d.payout, sub: `for ${d.amount}` },
      rows: [
        ["Deal", d.ref],
        ["Received", d.amount],
      ],
      button: { href: d.adminUrl, label: `Open deal ${d.ref}` },
      audience: "team",
    }),
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
    html: shell({
      preheader: `${d.payout} has been sent to your ${d.account}.`,
      kicker: "Receipt",
      badge: `PAID OUT · ${d.ref}`,
      tone: "ok",
      title: "Your money is on its way",
      intro: `${d.payout} has been sent to your ${d.account}.`,
      hero: { label: "Paid out", value: d.payout, sub: `to your ${d.account}` },
      rows: [
        ["Deal", d.ref],
        ["Account", d.account],
        ["Bank reference", d.reference],
      ],
      note: `Thank you for choosing ${d.brand}.`,
      audience: "customer",
    }),
  };
}

// Market-priced coins (BTC, Phase 13b): the price moved past the margin
// while the coins confirmed. Ref, amount and the admin link only.
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
    html: shell({
      preheader: `Coins received on ${d.ref}. The price moved: agree the payout.`,
      kicker: "Rate to agree",
      badge: `RATE TO AGREE · ${d.ref}`,
      tone: "warn",
      title: "Coins received: agree the payout",
      intro:
        "The price moved past the margin while the coins confirmed. Agree the payout with the customer on WhatsApp, then record it to start the payout timer.",
      hero: { label: "Received", value: d.amount },
      rows: [
        ["Deal", d.ref],
        ["Received", d.amount],
      ],
      button: { href: d.adminUrl, label: `Open deal ${d.ref}` },
      audience: "team",
    }),
  };
}
