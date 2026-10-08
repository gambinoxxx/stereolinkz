"use client";

import { useEffect, useState } from "react";

import {
  usePageVisible,
  useReducedMotion,
} from "@/features/public/motion/hooks";

// "On WhatsApp, you can <phrase>": the phrase slides up and is replaced
// every 2.4 s. Screen readers get the whole list once instead.
export function Rotator({
  lead,
  phrases,
}: {
  lead: string;
  phrases: string[];
}) {
  const [state, setState] = useState({ on: 0, out: -1 });
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  useEffect(() => {
    if (reduced || !visible || phrases.length < 2) return;
    const id = window.setInterval(
      () => setState((s) => ({ on: (s.on + 1) % phrases.length, out: s.on })),
      2400,
    );
    return () => window.clearInterval(id);
  }, [reduced, visible, phrases.length]);

  return (
    <p className="rot">
      <span aria-hidden="true">{lead}</span>
      <span className="slot" aria-hidden="true">
        {/* sizes the slot to the longest phrase (they come from the boards) */}
        <span className="sizer">
          {phrases.reduce((a, b) => (b.length > a.length ? b : a), "")}
        </span>
        {phrases.map((phrase, i) => (
          <span
            key={phrase}
            className={
              i === state.on ? "on" : i === state.out ? "out" : undefined
            }
          >
            {phrase}
          </span>
        ))}
      </span>
      <span className="sr">
        {lead} {phrases.join(", ")}.
      </span>
    </p>
  );
}
