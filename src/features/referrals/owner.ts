// The guard every owner-only referral action starts with (Phase 13c):
// the programme, codes and rewards are changed by an OWNER only.
import type { ActionResult } from "@/lib/server/action";
import type { MemberRole } from "@/generated/prisma/enums";

export const OWNER_ONLY = "Only the owner can change referrals.";

export function ownerOnly(member: {
  role: MemberRole;
}): ActionResult<never> | null {
  return member.role === "OWNER" ? null : { ok: false, error: OWNER_ONLY };
}
