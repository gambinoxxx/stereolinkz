"use client";

import { useEffect } from "react";

import { readReferralCookie } from "@/features/referrals/cookie";

// The deal forms' optional "Referral code" (deal.css .fld / .inp). Shown
// only while the programme is on for the service; prefilled once from the
// ?ref= cookie. A bad code gets a friendly error from the server, and the
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readReferralCookie();
      if (saved && !value) onChange(saved);
    }, 0);
    return () => window.clearTimeout(timer);
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
