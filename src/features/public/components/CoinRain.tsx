"use client";

import { useRef } from "react";

import { useInView } from "@/features/public/motion/hooks";

const SYMBOLS = ["₦", "$", "£", "€", "₮", "₿"];
const KINDS = ["g", "v", "g", "v", "t", "o"];

// Fixed "random" timings, the same on the server and in the browser.
const COINS = Array.from({ length: 12 }, (_, i) => ({
  sym: SYMBOLS[i % 6]!,
  kind: KINDS[i % 6]!,
  left: `${5 + i * 8}%`,
  duration: `${7 + ((i * 37) % 60) / 10}s`,
  delay: `${-((i * 53) % 100) / 10}s`,
}));

// Coins falling behind the closing call to action. A CSS animation that
// only plays while the box is on screen; off with reduced motion.
export function CoinRain() {
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  return (
    <div className={`rain${inView ? " run" : ""}`} ref={box} aria-hidden="true">
      {COINS.map((c, i) => (
        <span
          key={i}
          className={`coin s ${c.kind}`}
          style={{
            left: c.left,
            animationDuration: c.duration,
            animationDelay: c.delay,
          }}
        >
          {c.sym}
        </span>
      ))}
    </div>
  );
}
