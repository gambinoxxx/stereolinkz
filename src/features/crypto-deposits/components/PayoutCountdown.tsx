"use client";

import { useEffect, useState } from "react";

const R = 100;
const C = 2 * Math.PI * R;

// The payout ring (deal-crypto-payout.html): counts down to payoutDueAt;
// after it, "taking a little longer" (never a broken promise).
export function PayoutCountdown({
  dueAt,
  totalMinutes,
}: {
  dueAt: string;
  totalMinutes: number;
}) {
  const due = new Date(dueAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  const s = Math.max(
    0,
    Math.floor((due - (now ?? due - totalMinutes * 60_000)) / 1000),
  );
  const late = now !== null && now >= due;
  const p = Math.min(1, s / (totalMinutes * 60));
  const text = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <>
      {!late && (
        <div className="count">
          <svg
            width="230"
            height="230"
            viewBox="0 0 230 230"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="payout-arc">
                <stop offset="0" className="stop-a" />
                <stop offset="1" className="stop-b" />
              </linearGradient>
            </defs>
            <circle
              className="track"
              cx="115"
              cy="115"
              r={R}
              fill="none"
              strokeWidth="16"
            />
            <circle
              cx="115"
              cy="115"
              r={R}
              fill="none"
              stroke="url(#payout-arc)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p)}
            />
          </svg>
          <div className="t">
            <b className="num" suppressHydrationWarning>
              {text}
            </b>
            <small>Payout target</small>
          </div>
        </div>
      )}
      {late && (
        <p
          className="note warn"
          style={{ margin: "18px auto 0", maxWidth: 520 }}
          role="status"
        >
          Taking a little longer than usual. Our team has been alerted and will
          message you on WhatsApp.
        </p>
      )}
    </>
  );
}
