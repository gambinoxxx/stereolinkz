import { Fragment } from "react";

import type { TickerItem } from "@/features/public/landing-view";

// A tilted strip of rates or services. Server markup: the items are
// repeated so one copy is wider than the screen, then doubled, so the
// motion (loaded after the page by LandingMotion) can wrap after one copy.
// It scrolls on its own and speeds up with the page's scroll velocity.
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
  if (!items.length) return null;
  const base: TickerItem[] = [];
  while (base.length < 8) base.push(...items);
  return (
    <div
      className={`ticker${alt ? " alt" : ""}`}
      data-motion="ticker"
      data-speed={speed}
    >
      <p className="sr">{label}</p>
      <div className="track" aria-hidden="true">
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
