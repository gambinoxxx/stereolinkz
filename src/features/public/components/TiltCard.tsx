"use client";

import { type ReactNode, useRef } from "react";

import {
  useFinePointer,
  useInView,
  useReducedMotion,
  useScrollProgress,
} from "@/features/public/motion/hooks";

// The school-fees example card: tilts toward a fine pointer, and with the
// scroll otherwise. Its progress bar fills once when half of it is seen.
export function TiltCard({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const seen = useInView(stage, { threshold: 0.5, once: true });

  // Scroll tilt: centred in the viewport → flat.
  useScrollProgress(
    stage,
    () => {
      const el = stage.current;
      if (!el || !tilt.current || hovering.current) return;
      const r = el.getBoundingClientRect();
      const k =
        (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      tilt.current.style.transform = `rotateX(${k * 16}deg) rotateY(${-k * 10}deg)`;
    },
    !reduced,
  );

  return (
    <div
      className="tilt-stage rv"
      ref={stage}
      onPointerMove={(e) => {
        if (reduced || !fine || !tilt.current || !stage.current) return;
        hovering.current = true;
        const r = stage.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.current.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg)`;
      }}
      onPointerLeave={() => {
        hovering.current = false;
        if (tilt.current) tilt.current.style.transform = "";
      }}
    >
      <div className={`tilt${seen ? " go" : ""}`} ref={tilt}>
        {children}
      </div>
    </div>
  );
}
