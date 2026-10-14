import "server-only";

import { Resend } from "resend";

// Email through Resend (team alerts, the customer's deal link). Off unless
// RESEND_API_KEY and DEAL_ALERT_FROM are set. Never throws: a failed email
// never fails the deal. Logs only the failure type, never addresses or
// contents.
export function emailReady(): boolean {
  return (
    !!process.env.RESEND_API_KEY?.trim() &&
    !!process.env.DEAL_ALERT_FROM?.trim()
  );
}

// Customer emails need a verified sending domain: Resend's test sender
// (@resend.dev) only delivers to the Resend account's own address.
export function customerEmailReady(): boolean {
  return (
    emailReady() &&
    !/@resend\.dev>?\s*$/i.test(process.env.DEAL_ALERT_FROM!.trim())
  );
}

export type Email = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(email: Email): Promise<boolean> {
  if (!emailReady() || email.to.length === 0) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { error } = await resend.emails.send({
      from: process.env.DEAL_ALERT_FROM!.trim(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (error) {
      console.error(`[email] send failed: ${error.name ?? "error"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[email] send failed: ${error instanceof Error ? error.name : "error"}`,
    );
    return false;
  }
}

// One email per address, so one refused address (for example while the
// sender is Resend's test address) doesn't stop the others. Returns how
// many were sent.
export async function sendEach(
  to: string[],
  email: Omit<Email, "to">,
): Promise<number> {
  let sent = 0;
  for (const address of to)
    if (await sendEmail({ ...email, to: [address] })) sent++;
  return sent;
}

// DEAL_ALERT_TO: comma-separated team inboxes.
export function alertRecipients(): string[] {
  return (process.env.DEAL_ALERT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}
