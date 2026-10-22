// A deal's referral outcome for the team (the deal page's "Referral"
// line): the code it was referred by, or why no code is attached. Worked
// out from the deal's own events, so every skip is visible, including
// deals made before reasons were stored (their words are matched).
import { ATTACH_SKIPS, type AttachSkip } from "@/features/referrals/rules";

export type AttachOutcome =
  | { attached: true; code: string }
  | {
      attached: false;
      code: string | null; // the code that came with the deal, if any
      reason: AttachSkip | "no_code" | "removed" | "other";
      note: string | null; // the team's reason (removed), or the event's words (other)
    };

type Event = {
  type: string; // "REFERRAL" | "REFERRAL_REMOVED" | …
  message: string;
  data: unknown;
};

// Older events' words → the reason (newest wording first).
const LEGACY: [RegExp, AttachSkip][] = [
  [/no referral campaign is running|programme is off/i, "no_campaign"],
  [/don’t have that code|don't have that code/i, "unknown_code"],
  [/code isn’t active|code isn't active/i, "inactive_code"],
  [/own WhatsApp number/i, "staff_own_number"],
  [/completed a deal with us before/i, "not_new_customer"],
  [
    /isn’t part of the campaign|isn't part of the campaign/i,
    "service_not_eligible",
  ],
];

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

// `events`: the deal's REFERRAL and REFERRAL_REMOVED events, oldest first.
export function attachOutcome(
  attachedCode: string | null,
  events: Event[],
): AttachOutcome {
  if (attachedCode) return { attached: true, code: attachedCode };
  for (const e of [...events].reverse()) {
    const data = record(e.data);
    const code = typeof data.code === "string" ? data.code : null;
    if (e.type === "REFERRAL_REMOVED")
      return {
        attached: false,
        code,
        reason: "removed",
        note: typeof data.reason === "string" ? data.reason : null,
      };
    if (e.type !== "REFERRAL" || data.applied !== false) continue;
    const skip = ATTACH_SKIPS.find((s) => s === data.skip);
    const legacy = LEGACY.find(([re]) => re.test(e.message))?.[1];
    // A team member's own number on a customer code reads the same in
    // old events; "staff's own number" is right for staff codes, which
    // were the only kind before reasons were stored.
    const reason = skip ?? legacy;
    return reason
      ? { attached: false, code, reason, note: null }
      : { attached: false, code, reason: "other", note: e.message };
  }
  return { attached: false, code: null, reason: "no_code", note: null };
}
