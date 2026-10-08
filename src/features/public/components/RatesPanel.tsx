"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { BankMark } from "@/components/bank-mark";
import { CoinBadge } from "@/components/coin-badge";
import { CurrencyFlag } from "@/components/currency-flag";
import { UpdatedLabel } from "@/features/public/components/UpdatedLabel";
import type {
  PublicCryptoRow,
  PublicForexRow,
  PublicPofRow,
} from "@/features/public/landing-data";
import { useInView, useReducedMotion } from "@/features/public/motion/hooks";
import { formatPercent, formatRate } from "@/lib/format";

type Meta = { createdAt: string; timeLabel: string };
export type RateTab =
  | (Meta & {
      key: "forex";
      label: string;
      disclaimer: string;
      rows: PublicForexRow[];
    })
  | (Meta & {
      key: "crypto";
      label: string;
      disclaimer: string;
      rows: PublicCryptoRow[];
    })
  | (Meta & {
      key: "pof";
      label: string;
      disclaimer: string;
      rows: PublicPofRow[];
    });

// Counts a number up from zero, ending on the exact board text. Display
// only: the figure shown at rest is always the server's string.
function countUp(el: HTMLElement) {
  const final = el.dataset.final ?? "";
  const to = parseFloat(final.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(to)) return;
  const decimals = (final.split(".")[1] ?? "").replace(/\D/g, "").length;
  const suffix = final.endsWith("%") ? "%" : "";
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min((now - start) / 900, 1);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent =
      k < 1
        ? (to * e).toLocaleString("en-NG", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) + suffix
        : final;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function Value({ kind, text }: { kind: "buy" | "sell"; text: string }) {
  return (
    <span className={`val ${kind} num`} data-final={text}>
      {text}
    </span>
  );
}

function Rows({ tab }: { tab: RateTab }) {
  switch (tab.key) {
    case "forex":
      return tab.rows.map((r) => (
        <div className="rrow" key={r.code}>
          <div className="ent">
            <CurrencyFlag
              flagCode={r.flagCode}
              currencyCode={r.code}
              size={44}
              className="mark"
            />
            <span>
              <b>{r.code}</b>
              <small>{r.name}</small>
            </span>
          </div>
          <Value kind="buy" text={formatRate(r.buy)} />
          <Value kind="sell" text={formatRate(r.sell)} />
        </div>
      ));
    case "crypto":
      return tab.rows.map((r) => (
        <div className="rrow" key={r.ticker}>
          <div className="ent">
            <CoinBadge
              ticker={r.ticker}
              name={r.name}
              iconUrl={r.iconUrl}
              badgeColor={r.badgeColor}
              size={44}
              className="mark"
            />
            <span>
              <b>{r.ticker}</b>
              <small>
                {r.name} ·{" "}
                {r.networks.length ? r.networks.join(", ") : "per $1"}
              </small>
            </span>
          </div>
          <Value kind="buy" text={formatRate(r.buy)} />
          <Value kind="sell" text={formatRate(r.sell)} />
        </div>
      ));
    case "pof":
      return tab.rows.map((r) => (
        <div className="rrow pof" key={r.name}>
          <div className="ent">
            <BankMark
              name={r.name}
              slug={r.name.toLowerCase()}
              logoUrl={r.logoUrl}
              size={44}
              className="mark"
            />
            <span>
              <b>{r.shortName ?? r.name}</b>
              <small>{r.note ?? " "}</small>
            </span>
          </div>
          <Value kind="buy" text={formatPercent(r.rate)} />
        </div>
      ));
  }
}

const HEADS = {
  forex: ["Currency", "We buy", "We sell"],
  crypto: ["Coin", "We buy", "We sell"],
  pof: ["Bank", "Per month"],
} as const;

// Today's rates, one tab per board type that has a board. Rows slide in
// and count up the first time the panel is seen and on each tab change.
export function RatesPanel({
  tabs,
  timeZone,
}: {
  tabs: RateTab[];
  timeZone: string;
}) {
  const [selected, setSelected] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const pill = useRef<HTMLSpanElement>(null);
  const lists = useRef<(HTMLDivElement | null)[]>([]);
  const seen = useInView(panel, { threshold: 0.2, once: true });
  const reduced = useReducedMotion();
  const tab = tabs[selected]!;

  // The highlight slides to the selected tab.
  useLayoutEffect(() => {
    const place = () => {
      const b = buttons.current[selected];
      if (!b || !pill.current) return;
      pill.current.style.width = `${b.offsetWidth}px`;
      pill.current.style.transform = `translateX(${b.offsetLeft - 5}px)`;
    };
    place();
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [selected]);

  useEffect(() => {
    const list = lists.current[selected];
    if (!list || !seen) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".rrow"));
    if (reduced) {
      rows.forEach((r) => r.classList.add("in"));
      return;
    }
    rows.forEach((r) => r.classList.remove("in"));
    const timers = rows.map((r, i) =>
      window.setTimeout(() => {
        r.classList.add("in");
        r.querySelectorAll<HTMLElement>("[data-final]").forEach(countUp);
      }, 80 * i),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [selected, seen, reduced]);

  function onKey(e: KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next =
      (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setSelected(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className="panel rv" ref={panel}>
      <div className="ptop">
        <div className="tabs" role="tablist" aria-label="Rate type">
          <span className="pill" ref={pill} aria-hidden="true" />
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={i === selected}
              aria-controls={`panel-${t.key}`}
              tabIndex={i === selected ? 0 : -1}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="upd">
          <span className="live" aria-hidden="true" />
          <UpdatedLabel
            createdAt={tab.createdAt}
            timeZone={timeZone}
            timeLabel={tab.timeLabel}
          />
        </span>
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`panel-${t.key}`}
          aria-labelledby={`tab-${t.key}`}
          hidden={i !== selected}
        >
          <div className={`rhead${t.key === "pof" ? " pof" : ""}`}>
            {HEADS[t.key].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div
            className="rlist"
            ref={(el) => {
              lists.current[i] = el;
            }}
          >
            <Rows tab={t} />
          </div>
          <p className="disc">{t.disclaimer}</p>
        </div>
      ))}
    </div>
  );
}
