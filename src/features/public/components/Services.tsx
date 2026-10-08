"use client";

import { type ReactNode, useRef, useState } from "react";

import type { ServiceFact } from "@/features/public/landing-view";
import { clamp, useScrollProgress } from "@/features/public/motion/hooks";

export type ServiceItem = {
  tag: string;
  title: string;
  body: string;
  facts: ServiceFact[];
};

// "What we do": the section is four screens tall and its content is pinned.
// Scrolling through it steps through the four services; the phone screen,
// the progress bars and the background colour follow. Works the same with
// reduced motion, only without the transitions.
export function Services({
  kicker,
  items,
  screens,
}: {
  kicker: string;
  items: ServiceItem[];
  screens: ReactNode[];
}) {
  const section = useRef<HTMLElement>(null);
  const dots = useRef<(HTMLElement | null)[]>([]);
  const [step, setStep] = useState(0);
  const n = items.length;

  useScrollProgress(section, (p) => {
    const sp = clamp(p, 0, 0.9999);
    setStep(Math.floor(sp * n));
    dots.current.forEach((d, k) => {
      if (d) d.style.transform = `scaleX(${clamp(sp * n - k, 0, 1)})`;
    });
  });

  return (
    <section className="scrolly" id="services" ref={section}>
      <div className="pin-outer">
        <div className="sc-bgs" aria-hidden="true">
          {items.map((_, k) => (
            <i key={k} className={`b${k}${k === step ? " on" : ""}`} />
          ))}
        </div>
        <div className="pin wrap">
          <div>
            <h2 className="kicker">{kicker}</h2>
            <div className="sc-text">
              {items.map((item, k) => (
                <div
                  key={item.tag}
                  className={`sc-item${k === step ? " on" : k < step ? " past" : ""}`}
                >
                  <span className="tag">{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {item.facts.length > 0 && (
                    <div className="facts">
                      {item.facts.map((f) => (
                        <span key={f.label}>
                          <small>{f.label}</small>
                          {f.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="dots" aria-hidden="true">
              {items.map((_, k) => (
                <i key={k}>
                  <b
                    ref={(el) => {
                      dots.current[k] = el;
                    }}
                  />
                </i>
              ))}
            </div>
          </div>
          <div className="sc-phone" aria-hidden="true">
            <span className="sc-ring">
              <i />
            </span>
            <span className="sc-ring r2">
              <i />
            </span>
            <div className="phone">
              <div className="screen">
                <div className="screens">
                  {screens.map((s, k) => (
                    <div
                      key={k}
                      className={`scr${k === step ? " on" : k < step ? " past" : ""}`}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="glare" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
