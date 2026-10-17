"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";

const left = (until: number) =>
  Math.max(0, Math.floor((until - Date.now()) / 1000));

// The rate-lock ring (deal-crypto-deposit.html). Re-reads the deal when
// the lock ends, so the address disappears without a reload.
export function LockTimer({
  expiresAt,
  totalMinutes,
  rateLabel,
}: {
  expiresAt: string;
  totalMinutes: number;
  rateLabel: string;
}) {
  const router = useRouter();
  const until = new Date(expiresAt).getTime();
  const [secs, setSecs] = useState<number | null>(null);
  const refreshed = useRef(false);
  useEffect(() => {
    const tick = () => {
      const s = left(until);
      setSecs(s);
      if (s === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until, router]);

  const s = secs ?? left(until);
  const p = Math.min(1, s / (totalMinutes * 60));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="timer">
      <span className="ring" style={{ "--p": p } as CSSProperties}>
        <span>{Math.round(p * 100)}%</span>
      </span>
      <div>
        <small>Rate locked for</small>
        <b className="num" suppressHydrationWarning>
          {text}
        </b>
        <small>{rateLabel} · then re-quoted</small>
      </div>
    </div>
  );
}
