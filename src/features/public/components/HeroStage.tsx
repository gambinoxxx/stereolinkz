"use client";

import { type ReactNode, useEffect, useRef } from "react";

import {
  clamp,
  useFinePointer,
  useFrame,
  useInView,
  usePointer,
  useReducedMotion,
} from "@/features/public/motion/hooks";

// Decorative coins: symbol, colour class, orbit radius, start angle, speed.
const COINS = [
  { sym: "₦", cls: "g", r: 300, a: 200, s: 0.22 },
  { sym: "$", cls: "v", r: 330, a: 330, s: 0.18 },
  { sym: "£", cls: "g s", r: 250, a: 20, s: 0.26 },
  { sym: "₮", cls: "t", r: 360, a: 100, s: 0.15 },
  { sym: "₿", cls: "o s", r: 270, a: 150, s: 0.2 },
  { sym: "Ξ", cls: "b s", r: 345, a: 250, s: 0.24 },
  { sym: "€", cls: "v s", r: 230, a: 290, s: 0.3 },
] as const;

// Where a coin sits at time t (seconds), with the pointer offset and the
// page scroll. Rounded, so the server's first paint matches the browser's.
function coinTransform(
  k: number,
  t: number,
  scale: number,
  mx = 0,
  my = 0,
  scrollY = 0,
) {
  const c = COINS[k]!;
  const a = ((c.a + t * c.s * 40) * Math.PI) / 180;
  const x = Math.cos(a) * c.r * scale + mx * (30 + k * 8);
  const y =
    Math.sin(a) * c.r * scale * 0.42 +
    my * (30 + k * 6) -
    scrollY * (0.15 + k * 0.04) -
    90;
  const z = Math.sin(a);
  return {
    transform: `translate(${Math.round(x)}px,${Math.round(y)}px) scale(${(0.8 + z * 0.25).toFixed(3)}) rotate(${Math.round(t * 20 * (k % 2 ? 1 : -1))}deg)`,
    zIndex: z > 0 ? 7 : 1,
    opacity: (0.55 + (0.45 * (z + 1)) / 2).toFixed(3),
  };
}

// The hero's 3D phone (the latest Forex board) with orbiting coins and
// example notifications. The phone starts tilted and straightens as the
// page scrolls; on a fine pointer it leans toward the mouse. One frame
// loop, only while the stage is on screen and the tab is visible.
export function HeroStage({
  screen,
  notes,
}: {
  screen: ReactNode;
  notes: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const coins = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const inView = useInView(stage);
  const pointer = usePointer(fine && !reduced);
  const eased = useRef({ x: 0, y: 0, t0: 0 });

  // Still version (and first paint on phones): coins placed once, smaller
  // orbit on narrow screens.
  useEffect(() => {
    if (!reduced) return;
    const place = () => {
      const scale = window.innerWidth < 860 ? 0.62 : 1;
      coins.current.forEach((el, k) => {
        if (el) Object.assign(el.style, coinTransform(k, 0, scale));
      });
    };
    place();
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [reduced]);

  useFrame((now) => {
    const e = eased.current;
    if (!e.t0) e.t0 = now;
    const t = (now - e.t0) / 1000;
    e.x += (pointer.x - e.x) * 0.06;
    e.y += (pointer.y - e.y) * 0.06;
    const y = window.scrollY;
    const p = clamp(y / (window.innerHeight * 0.7), 0, 1);
    if (phone.current)
      phone.current.style.transform = `translateY(${90 - 90 * p}px) rotateX(${26 - 26 * p + e.y * -6}deg) rotateY(${e.x * 14}deg) rotateZ(${-6 + 6 * p}deg) scale(${0.88 + 0.12 * p})`;
    const scale = window.innerWidth < 860 ? 0.62 : 1;
    coins.current.forEach((el, k) => {
      if (el) Object.assign(el.style, coinTransform(k, t, scale, e.x, e.y, y));
    });
  }, inView && !reduced);

  return (
    <div className="stage" ref={stage} aria-hidden="true">
      <div className="orbit">
        {COINS.map((c, k) => (
          <span
            key={c.sym}
            className={`coin ${c.cls}`}
            ref={(el) => {
              coins.current[k] = el;
            }}
            style={coinTransform(k, 0, 1)}
          >
            {c.sym}
          </span>
        ))}
      </div>
      <div className="phone hero-phone" ref={phone}>
        <div className="screen">{screen}</div>
        <div className="glare" />
      </div>
      {notes}
    </div>
  );
}
