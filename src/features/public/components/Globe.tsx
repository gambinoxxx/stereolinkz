"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { flagDataUri } from "@/features/templates/assets/flags";
import {
  clamp,
  useFrame,
  useInView,
  useReducedMotion,
} from "@/features/public/motion/hooks";

type City = { name: string; flag: string; left: string; top: string };

const LAGOS = [-10, 40] as const;
// Route ends on the globe, in the same order as the cities.
const ENDS = [
  [-60, -150],
  [-185, -70],
  [-150, -155],
  [150, -110],
  [40, -185],
] as const;
const ROUTES = ENDS.map(([x, y]) => {
  const c = [(LAGOS[0] + x) / 2, (LAGOS[1] + y) / 2 - 90] as const;
  return { end: [x, y] as const, c };
});
const LATS = [-150, -100, -50, 0, 50, 100, 150].map((y) => ({
  y,
  rx: Math.round(Math.sqrt(200 * 200 - y * y) * 10) / 10,
}));

// A point along a quadratic curve (close enough to arc length here).
function at(
  t: number,
  end: readonly [number, number],
  c: readonly [number, number],
) {
  const u = 1 - t;
  return [
    u * u * LAGOS[0] + 2 * u * t * c[0] + t * t * end[0],
    u * u * LAGOS[1] + 2 * u * t * c[1] + t * t * end[1],
  ];
}

// Payments abroad: the meridians turn, and routes draw from Lagos to each
// city in turn, lighting its label. Runs only while on screen; with
// reduced motion every route and city is shown at once.
export function Globe({
  cities,
  home,
}: {
  cities: City[];
  home: { name: string; flag: string };
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const mers = useRef<(SVGEllipseElement | null)[]>([]);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const start = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const inView = useInView(wrap, { threshold: 0.25 });

  useEffect(() => {
    if (!reduced) return;
    paths.current.forEach((p) => p && (p.style.strokeDashoffset = "0"));
    labels.current.forEach((l) => l?.classList.add("on"));
  }, [reduced]);

  useFrame((now) => {
    const t = now / 1000;
    mers.current.forEach((e, k) => {
      if (e)
        e.style.transform = `scaleX(${Math.abs(Math.cos(t * 0.35 + (k * Math.PI) / 8)).toFixed(4)})`;
    });
    if (start.current === null) start.current = now;
    const el = (now - start.current) / 1000;
    ROUTES.forEach((r, k) => {
      const pr = el < k * 0.7 ? 0 : clamp(((el - k * 0.7) % 5.5) / 1.4, 0, 1);
      const path = paths.current[k];
      const dot = dots.current[k];
      if (path) path.style.strokeDashoffset = String(1 - pr);
      if (dot) {
        const [x, y] = at(pr, r.end, r.c);
        dot.style.transform = `translate(${x}px,${y}px)`;
        dot.style.opacity = pr > 0 && pr < 1 ? "1" : "0";
      }
      if (pr >= 1) labels.current[k]?.classList.add("on");
    });
  }, inView && !reduced);

  return (
    <div className="globe-wrap rv" ref={wrap} aria-hidden="true">
      <svg viewBox="-260 -260 520 520" aria-hidden="true">
        <defs>
          <radialGradient id="globe-fill" cx="35%" cy="30%">
            <stop offset="0" className="g-s1" />
            <stop offset=".7" className="g-s2" />
            <stop offset="1" className="g-s3" />
          </radialGradient>
          <linearGradient id="globe-arc" x1="0" x2="1">
            <stop offset="0" className="a-s1" />
            <stop offset="1" className="a-s2" />
          </linearGradient>
        </defs>
        <circle r="250" className="halo" />
        <circle r="200" fill="url(#globe-fill)" />
        <g className="grid-lines">
          {LATS.map((l) => (
            <ellipse
              key={l.y}
              cx="0"
              cy={l.y}
              rx={l.rx}
              ry={Math.round(l.rx * 1.2) / 10}
            />
          ))}
          {Array.from({ length: 8 }, (_, k) => (
            <ellipse
              key={k}
              className="mer"
              cx="0"
              cy="0"
              rx="200"
              ry="200"
              ref={(el) => {
                mers.current[k] = el;
              }}
            />
          ))}
        </g>
        <circle r="200" className="rim" />
        <g>
          {ROUTES.map((r, k) => (
            <g key={k}>
              <path
                className="route"
                d={`M${LAGOS[0]} ${LAGOS[1]} Q${r.c[0]} ${r.c[1]} ${r.end[0]} ${r.end[1]}`}
                pathLength={1}
                ref={(el) => {
                  paths.current[k] = el;
                }}
              />
              <circle
                className="runner"
                r="4.5"
                ref={(el) => {
                  dots.current[k] = el;
                }}
              />
              <circle className="route-end" cx={r.end[0]} cy={r.end[1]} r="5" />
            </g>
          ))}
        </g>
        <circle className="lagos" cx={LAGOS[0]} cy={LAGOS[1]} r="7" />
        <circle className="lagos-pulse" cx={LAGOS[0]} cy={LAGOS[1]} r="7" />
      </svg>
      {cities.map((city, k) => (
        <span
          key={city.name}
          className="city"
          style={{ left: city.left, top: city.top }}
          ref={(el) => {
            labels.current[k] = el;
          }}
        >
          <CityFlag code={city.flag} />
          {city.name}
        </span>
      ))}
      <span className="city on home">
        <CityFlag code={home.flag} />
        {home.name}
      </span>
    </div>
  );
}

function CityFlag({ code }: { code: string }) {
  const src = flagDataUri(code);
  return (
    <span className="f">
      {src && <Image src={src} alt="" width={24} height={24} unoptimized />}
    </span>
  );
}
