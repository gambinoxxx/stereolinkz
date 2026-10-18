"use client";

import { type ComponentType, useEffect, useState } from "react";

import { coinTransform, orbitScale } from "@/features/public/motion/hero-coins";

// The decorative motion (hero orbit and phone, tickers, the tilting card,
// the coin rain), loaded after the page has painted and hydrated, and not
// at all with reduced motion: then only the hero's coins are placed for
// the screen width (the CSS shows everything else still). A plain dynamic
// import: next/dynamic's loader would cost more than the motion code.
export function LandingMotion() {
  const [Effects, setEffects] = useState<ComponentType | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let live = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setStill(true), 0);
      return () => window.clearTimeout(timer);
    }
    import("@/features/public/motion/effects").then((m) => {
      if (live) setEffects(() => m.default);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!still) return;
    const coins = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-motion="hero"] .orbit .coin',
      ),
    );
    const place = () => {
      const scale = orbitScale();
      coins.forEach((el, k) =>
        Object.assign(el.style, coinTransform(k, 0, scale)),
      );
    };
    place();
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [still]);

  return Effects ? <Effects /> : null;
}
