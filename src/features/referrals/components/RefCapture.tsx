"use client";

import { useEffect } from "react";

import { saveReferralCookie } from "@/features/referrals/cookie";
import { normalizeCode } from "@/features/referrals/rules";

// stereolinkz.com/?ref=LYDIA (any public page): keep the code for 30 days
// so the deal form can prefill it. Only a well-formed code is kept; the
// server checks it again when a deal is submitted. Renders nothing.
export function RefCapture() {
  useEffect(() => {
    const code = normalizeCode(
      new URLSearchParams(window.location.search).get("ref"),
    );
    if (code) saveReferralCookie(code);
  }, []);
  return null;
}
