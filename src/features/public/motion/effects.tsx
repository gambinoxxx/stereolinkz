"use client";

// The landing page's decorative motion, loaded after the page by
// LandingMotion (next/dynamic, browser only) and never with reduced motion.
// Each piece finds the server markup it moves (data-motion) and uses the
// shared hooks: loops run only while their element is on screen and the
// tab is visible. Renders nothing of its own.
import { useEffect, useRef, useState } from "react";

import {
  clamp,
  useFinePointer,
  useFrame,
  useInView,
  usePointer,
  useScrollProgress,
} from "@/features/public/motion/hooks";
import { coinTransform, orbitScale } from "@/features/public/motion/hero-coins";

const find = (kind: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-motion="${kind}"]`));

// A stable ref to an element that already exists (this module renders only
// in the browser, after the server markup).
function useElementRef<T extends Element>(el: T) {
  return useRef<T | null>(el);
}

// A ref filled once with what find() returns (lazy, the first render only).
function useFound<T>(find: () => T) {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = find();
  return ref as { current: T };
}

// The hero: the phone straightens as the page scrolls and leans toward a
// fine pointer; the coins orbit. One frame loop.
function HeroMotion({ el }: { el: HTMLElement }) {
  const stage = useElementRef(el);
  const partsRef = useFound(() => ({
    phone: el.querySelector<HTMLElement>(".hero-phone"),
    coins: Array.from(el.querySelectorAll<HTMLElement>(".orbit .coin")),
  }));
  const fine = useFinePointer();
  const inView = useInView(stage);
  const pointer = usePointer(fine);
  const eased = useRef({ x: 0, y: 0, t0: 0 });

  useFrame((now) => {
    const e = eased.current;
    if (!e.t0) e.t0 = now;
    const t = (now - e.t0) / 1000;
    e.x += (pointer.x - e.x) * 0.06;
    e.y += (pointer.y - e.y) * 0.06;
    const y = window.scrollY;
    const p = clamp(y / (window.innerHeight * 0.7), 0, 1);
    const { phone, coins } = partsRef.current;
    if (phone)
      phone.style.transform = `translateY(${90 - 90 * p}px) rotateX(${26 - 26 * p + e.y * -6}deg) rotateY(${e.x * 14}deg) rotateZ(${-6 + 6 * p}deg) scale(${0.88 + 0.12 * p})`;
    const scale = orbitScale();
    coins.forEach((c, k) =>
      Object.assign(c.style, coinTransform(k, t, scale, e.x, e.y, y)),
    );
  }, inView);
  return null;
}

// A ticker scrolls on its own and speeds up with the page's scroll
// velocity, wrapping after one copy of its items.
function TickerMotion({ el }: { el: HTMLElement }) {
  const box = useElementRef(el);
  const trackRef = useFound(() => ({
    el: el.querySelector<HTMLElement>(".track"),
  }));
  const speed = Number(el.dataset.speed) || 0;
  const state = useRef({ x: 0, vel: 0, lastY: -1, w: 0 });
  const inView = useInView(box);

  // One copy's width, measured on resize (never inside the frame loop).
  useEffect(() => {
    const track = trackRef.current.el;
    if (!track) return;
    const measure = () => (state.current.w = track.scrollWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [trackRef]);

  useFrame(() => {
    const track = trackRef.current.el;
    if (!track) return;
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
    track.style.transform = `translateX(${s.x}px)`;
  }, inView);
  return null;
}

// The school-fees card tilts toward a fine pointer, and with the scroll
// otherwise; its progress bar fills once when half of it is seen.
function TiltMotion({ el }: { el: HTMLElement }) {
  const stage = useElementRef(el);
  const tiltRef = useFound(() => ({
    el: el.querySelector<HTMLElement>(".tilt"),
  }));
  const hovering = useRef(false);
  const fine = useFinePointer();
  const seen = useInView(stage, { threshold: 0.5, once: true });

  useEffect(() => {
    if (seen) tiltRef.current.el?.classList.add("go");
  }, [seen, tiltRef]);

  // Scroll tilt: centred in the viewport → flat.
  useScrollProgress(stage, () => {
    const tilt = tiltRef.current.el;
    if (!tilt || hovering.current) return;
    const r = el.getBoundingClientRect();
    const k =
      (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
    tilt.style.transform = `rotateX(${k * 16}deg) rotateY(${-k * 10}deg)`;
  });

  useEffect(() => {
    const tilt = tiltRef.current.el;
    if (!fine || !tilt) return;
    const move = (e: PointerEvent) => {
      hovering.current = true;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg)`;
    };
    const leave = () => {
      hovering.current = false;
      tilt.style.transform = "";
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [el, fine, tiltRef]);
  return null;
}

// The closing coin rain plays only while it's on screen.
function RainMotion({ el }: { el: HTMLElement }) {
  const box = useElementRef(el);
  const inView = useInView(box);
  useEffect(() => {
    el.classList.toggle("run", inView);
  }, [el, inView]);
  return null;
}

export default function LandingEffects() {
  const [els] = useState(() => ({
    hero: find("hero"),
    ticker: find("ticker"),
    tilt: find("tilt"),
    rain: find("rain"),
  }));
  return (
    <>
      {els.hero.map((el, i) => (
        <HeroMotion key={`h${i}`} el={el} />
      ))}
      {els.ticker.map((el, i) => (
        <TickerMotion key={`k${i}`} el={el} />
      ))}
      {els.tilt.map((el, i) => (
        <TiltMotion key={`t${i}`} el={el} />
      ))}
      {els.rain.map((el, i) => (
        <RainMotion key={`r${i}`} el={el} />
      ))}
    </>
  );
}
