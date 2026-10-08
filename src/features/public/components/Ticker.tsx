"use client";

import { Fragment, useEffect, useRef } from "react";

import type { TickerItem } from "@/features/public/landing-view";
import {
  useFrame,
  useInView,
  useReducedMotion,
} from "@/features/public/motion/hooks";

// A tilted strip that scrolls on its own and speeds up with the page's
// scroll velocity. The items are repeated so one copy is wider than the
// screen, then doubled, and the track wraps after one copy.
export function Ticker({
  items,
  speed,
  alt = false,
  label,
}: {
  items: TickerItem[];
  speed: number; // px per frame; negative runs right
  alt?: boolean;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const state = useRef({ x: 0, vel: 0, lastY: -1, w: 0 });
  const reduced = useReducedMotion();
  const inView = useInView(box);

  const base: TickerItem[] = [];
  while (items.length && base.length < 8) base.push(...items);

  // One copy's width, measured on resize (never inside the frame loop).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => (state.current.w = el.scrollWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useFrame(() => {
    const el = track.current;
    if (!el) return;
    const s = state.current;
    const y = window.scrollY;
    if (s.lastY < 0) s.lastY = y;
    s.vel = (s.vel + (y - s.lastY)) * 0.9;
    s.lastY = y;
    s.x -= speed * (1 + Math.min(Math.abs(s.vel) * 0.08, 6));
    const w = s.w;
    if (!w) return;
    if (s.x < -w) s.x += w;
    if (s.x > 0) s.x -= w;
    el.style.transform = `translateX(${s.x}px)`;
  }, inView && !reduced);

  if (!items.length) return null;
  return (
    <div className={`ticker${alt ? " alt" : ""}`} ref={box}>
      <p className="sr">{label}</p>
      <div className="track" ref={track} aria-hidden="true">
        {[0, 1].map((copy) =>
          base.map((item, i) => (
            <Fragment key={`${copy}-${i}`}>
              <span>
                {item.lead} <b className="num">{item.bold}</b>
                {item.tail && <em>{item.tail}</em>}
              </span>
              <i />
            </Fragment>
          )),
        )}
      </div>
    </div>
  );
}
