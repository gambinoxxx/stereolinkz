// The ?ref= cookie in the browser (Phase 13c): first-party, 30 days,
// SameSite=Lax, read by the deal forms to prefill the code. No tracking
// scripts; the server clears it when a deal is created.
import {
  normalizeCode,
  REF_COOKIE,
  REF_COOKIE_DAYS,
} from "@/features/referrals/rules";

export function readReferralCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${REF_COOKIE}=`));
  return match
    ? normalizeCode(decodeURIComponent(match.split("=")[1] ?? ""))
    : null;
}

export function saveReferralCookie(code: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REF_COOKIE}=${encodeURIComponent(code)}; Max-Age=${REF_COOKIE_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
}
