import type { ReactNode } from "react";

import { coinTransform, HERO_COINS } from "@/features/public/motion/hero-coins";

// The hero's 3D phone (the latest Forex board) with orbiting coins and
// example notifications. Server markup only: the phone starts tilted and
// the coins sit at their first positions; the motion (straightening with
// the scroll, leaning toward the mouse, the orbit) is loaded after the page
// by LandingMotion, and never with reduced motion.
export function HeroStage({
  screen,
  notes,
}: {
  screen: ReactNode;
  notes: ReactNode;
}) {
  return (
    <div className="stage" data-motion="hero" aria-hidden="true">
      <div className="orbit">
        {HERO_COINS.map((c, k) => (
          <span
            key={c.sym}
            className={`coin ${c.cls}`}
            style={coinTransform(k, 0, 1)}
          >
            {c.sym}
          </span>
        ))}
      </div>
      <div className="phone hero-phone">
        <div className="screen">{screen}</div>
        <div className="glare" />
      </div>
      {notes}
    </div>
  );
}
