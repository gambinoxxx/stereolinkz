"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/features/public/components/Wordmark";
import { useInView, useReducedMotion } from "@/features/public/motion/hooks";

export type ChatMessage = { from: "me" | "us"; text: string; time: string };

// How it works: the four steps auto-advance (each with a progress bar)
// while the example chat types its replies. Clicking a step jumps to it.
// With reduced motion the whole chat is shown and nothing advances.
export function Steps({
  steps,
  messages,
  restartLabel,
  chatLabel,
  brand,
}: {
  steps: { title: string; body: string }[];
  messages: ChatMessage[];
  restartLabel: string;
  chatLabel: string;
  brand: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const started = useInView(list, { threshold: 0.4, once: true });
  const reduced = useReducedMotion();
  const playing = started && !reduced;
  // typing: the reply for `step` is being typed; shown: it has arrived.
  // run changes on every jump, so the step's progress bar restarts.
  const [state, setState] = useState<{
    step: number;
    phase: "typing" | "shown";
    run: number;
  }>({ step: 0, phase: "typing", run: 0 });

  useEffect(() => {
    if (!playing) return;
    const last = state.step >= steps.length - 1;
    if (state.phase === "shown" && last) return;
    const t = window.setTimeout(
      () =>
        setState((s) =>
          s.phase === "typing"
            ? { ...s, phase: "shown" }
            : { step: s.step + 1, phase: "typing", run: s.run + 1 },
        ),
      state.phase === "typing" ? 800 : 2400,
    );
    return () => window.clearTimeout(t);
  }, [playing, state, steps.length]);

  const jump = (k: number) =>
    setState((s) => ({ step: k, phase: "typing", run: s.run + 1 }));

  const shown = reduced
    ? messages.length
    : !playing
      ? 0
      : state.phase === "typing"
        ? state.step
        : state.step + 1;
  const typing = playing && state.phase === "typing";

  return (
    <div className="grid2">
      <div>
        <div className="slist" ref={list}>
          {steps.map((s, k) => (
            <button
              key={s.title}
              type="button"
              className={`st${k === state.step ? " on" : ""}`}
              aria-current={k === state.step ? "step" : undefined}
              onClick={() => jump(k)}
            >
              <span className="n">{k + 1}</span>
              <span>
                <span className="st-title">{s.title}</span>
                <span className="st-body">{s.body}</span>
              </span>
              {/* keyed by run, so the bar restarts on every step change */}
              <span
                className="bar"
                key={`${state.run}-${k}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {!reduced && (
          <button type="button" className="restart" onClick={() => jump(0)}>
            <RotateCcw size={18} strokeWidth={2.2} aria-hidden="true" />
            {restartLabel}
          </button>
        )}
      </div>
      <div className="chat rv" role="group" aria-label={chatLabel}>
        <div className="who">
          <span className="av" aria-hidden="true">
            <Wordmark className="mark-only" />
          </span>
          <span>
            <b>{brand}</b>
            <small>{chatLabel}</small>
          </span>
        </div>
        {messages.map((m, k) => (
          <div key={k} className={`msg ${m.from}${k < shown ? " on" : ""}`}>
            {m.text}
            <small>{m.time}</small>
          </div>
        ))}
        <div className={`typing${typing ? " on" : ""}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
