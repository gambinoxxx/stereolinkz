"use client";

import { useEffect } from "react";

import { rememberReferral } from "@/features/deals/public-actions";
import { normalizeCode } from "@/features/referrals/rules";

// ?ref=CODE on any public page: the server checks the code and keeps it in
// the httpOnly referral cookie for 60 days (like /r/CODE). Renders nothing.
export function RefCapture() {
  useEffect(() => {
    const code = normalizeCode(
      new URLSearchParams(window.location.search).get("ref"),
    );
    if (code) void rememberReferral(code).catch(() => {});
  }, []);
  return null;
}
