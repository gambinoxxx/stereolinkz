"use client";

import { Fragment, useRef } from "react";

import {
  useReducedMotion,
  useScrollProgress,
} from "@/features/public/motion/hooks";

// The big outline words, sliding sideways with the scroll.
export function Mega({ words }: { words: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useScrollProgress(
    box,
    () => {
      const el = box.current;
      if (!el || !line.current) return;
      const top = el.getBoundingClientRect().top;
      line.current.style.transform = `translateX(${-((window.innerHeight - top) * 0.6)}px)`;
    },
    !reduced,
  );

  return (
    <div className="mega" ref={box} aria-hidden="true">
      <div className="line" ref={line}>
        {[0, 1].map((copy) =>
          words.map((w, i) => (
            <Fragment key={`${copy}-${w}`}>
              <span className={i % 2 ? "fill" : undefined}>{w}</span>
              <span className="star">✦</span>
            </Fragment>
          )),
        )}
      </div>
    </div>
  );
}
