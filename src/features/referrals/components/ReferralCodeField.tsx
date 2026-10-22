"use client";

import { useEffect } from "react";

import { referralFromCookie } from "@/features/deals/public-actions";
import { normalizeCode } from "@/features/referrals/rules";

// The deal forms' optional "Referral code" (deal.css .fld / .inp). Shown
// only while a campaign covers the service; prefilled once from ?ref= or
// the referral cookie. A bad code gets a friendly error from the server, and the
// customer can clear it and submit without one.
export function ReferralCodeField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  // Prefill once: ?ref= in this page's address, else the referral cookie
  // (httpOnly, so the server reads it). The customer can clear or edit it.
  useEffect(() => {
    let live = true;
    const fromUrl = normalizeCode(
      new URLSearchParams(window.location.search).get("ref"),
    );
    if (fromUrl) {
      const timer = window.setTimeout(() => !value && onChange(fromUrl), 0);
      return () => window.clearTimeout(timer);
    }
    referralFromCookie()
      .then((r) => {
        if (live && r.ok && r.data.code && !value) onChange(r.data.code);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // Once, after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fld">
      <label htmlFor={id}>
        Referral code{" "}
        <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
          (optional)
        </span>
      </label>
      <input
        className="inp"
        id={id}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        placeholder="e.g. LYDIA"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      {error && (
        <span className="ferr" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}
