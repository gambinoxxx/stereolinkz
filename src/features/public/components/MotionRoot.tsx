"use client";

import { useEffect } from "react";

// Page-wide motion over server-rendered markup: .rv blocks and .split
// headings get .in when they scroll into view (once), and .mag buttons
// lean toward a fine pointer. Renders nothing.
export function MotionRoot() {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const els = document.querySelectorAll<HTMLElement>(".lp .rv, .lp .split");
    if (reduced) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));

    const cleanups: (() => void)[] = [];
    if (window.matchMedia("(pointer: fine)").matches)
      document.querySelectorAll<HTMLElement>(".lp .mag").forEach((b) => {
        const move = (e: PointerEvent) => {
          const r = b.getBoundingClientRect();
          b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
        };
        const leave = () => (b.style.transform = "");
        b.addEventListener("pointermove", move, { passive: true });
        b.addEventListener("pointerleave", leave, { passive: true });
        cleanups.push(() => {
          b.removeEventListener("pointermove", move);
          b.removeEventListener("pointerleave", leave);
        });
      });

    return () => {
      io.disconnect();
      cleanups.forEach((c) => c());
    };
  }, []);
  return null;
}
