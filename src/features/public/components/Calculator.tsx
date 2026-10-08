"use client";

import { ArrowUpDown, MessageCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { content } from "@/features/public/content";
import { estimateNaira } from "@/features/public/estimate";
import {
  type CalcOption,
  calculatorMessage,
  naira,
} from "@/features/public/landing-view";
import { useReducedMotion } from "@/features/public/motion/hooks";
import { whatsappLink } from "@/features/public/whatsapp";

const c = content.calculator;

// "How much will I get?": amount × the board's rate in whole naira (decimal
// maths, estimateNaira). Selling uses our buy rate, buying our sell rate.
// The button opens WhatsApp with the amount, currency and rate written.
export function Calculator({
  options,
  brand,
  contactLine,
}: {
  options: CalcOption[];
  brand: string;
  contactLine: string | null;
}) {
  const id = useId();
  const [mode, setMode] = useState<"sell" | "buy">("sell");
  const [amount, setAmount] = useState("500");
  const [key, setKey] = useState(options[0]!.key);
  const [spun, setSpun] = useState(false);
  const option = options.find((o) => o.key === key) ?? options[0]!;
  const rate = mode === "sell" ? option.buy : option.sell;
  const estimate = estimateNaira(amount, rate);
  const text = estimate === null ? "—" : naira(estimate);

  // The figure rolls to its new value (display only; it rests on `text`).
  // React never re-renders this text (`first` is fixed), so the animation
  // can own it; screen readers read the <output> below instead.
  const out = useRef<HTMLSpanElement>(null);
  const [first] = useState(text);
  const shown = useRef<number | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = out.current;
    // Number() only drives the roll; the figure it rests on is `text`.
    const to = estimate === null ? null : Number(estimate);
    const from = shown.current;
    shown.current = to;
    if (!el || reduced || to === null || from === null || from === to) {
      if (el) el.textContent = text;
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const k = Math.min((now - start) / 500, 1);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent =
        k < 1
          ? `₦${Math.round(from + (to - from) * e).toLocaleString("en-NG")}`
          : text;
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [estimate, text, reduced]);

  // A half-typed or invalid amount is left out of the message.
  const href = whatsappLink(
    contactLine,
    calculatorMessage({
      brand,
      mode,
      amount: estimate === null ? "" : amount.trim(),
      option,
    }),
  );

  return (
    <aside className="calc rv" aria-labelledby={`${id}-title`}>
      <span className="glow" aria-hidden="true" />
      <h3 id={`${id}-title`}>{c.title}</h3>
      <div
        className={`mode${mode === "buy" ? " buy" : ""}`}
        role="group"
        aria-label="Direction"
      >
        <span className="pill" aria-hidden="true" />
        <button
          type="button"
          aria-pressed={mode === "sell"}
          onClick={() => setMode("sell")}
        >
          {c.selling}
        </button>
        <button
          type="button"
          aria-pressed={mode === "buy"}
          onClick={() => setMode("buy")}
        >
          {c.buying}
        </button>
      </div>
      <div className="fld">
        <label htmlFor={`${id}-amt`}>
          {mode === "sell" ? c.youSend : c.youWant}
        </label>
        <div className="row">
          <input
            id={`${id}-amt`}
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={`${id}-rate`}
          />
          <select
            aria-label="Currency or coin"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className={`swap${spun ? " spin" : ""}`}
        aria-label="Switch between selling and buying"
        onClick={() => {
          setSpun((s) => !s);
          setMode((m) => (m === "sell" ? "buy" : "sell"));
        }}
      >
        <ArrowUpDown size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <div className="fld">
        <span className="lbl" id={`${id}-out-label`}>
          {mode === "sell" ? c.youReceive : c.youPay}
        </span>
        <div className="row">
          <span className="out num" ref={out} aria-hidden="true">
            {first}
          </span>
          <output
            className="sr"
            aria-labelledby={`${id}-out-label`}
            aria-live="polite"
          >
            {text}
          </output>
        </div>
      </div>
      <p className="rate-line" id={`${id}-rate`}>
        Rate: {naira(rate)} {option.unit}
      </p>
      <a className="btn gold mag" href={href} target="_blank" rel="noopener">
        <MessageCircle strokeWidth={2.2} aria-hidden="true" />
        {c.cta}
      </a>
      <p className="fine">{c.fine}</p>
    </aside>
  );
}
