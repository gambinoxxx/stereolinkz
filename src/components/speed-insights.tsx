"use client";

import {
  type ComponentProps,
  type ComponentType,
  useEffect,
  useState,
} from "react";

import type { SpeedInsights as VercelSpeedInsights } from "@vercel/speed-insights/next";

// Vercel Speed Insights (page speed only, no personal data). Every URL is
// sent without its query and hash, so a deal's tracking token (?t=…) never
// leaves the browser, and deal references are replaced by "[ref]".
export function sanitizeVitalsUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname
    .replace(/^\/deal\/(?!new(?:\/|$)|check-eth(?:\/|$))[^/]+/, "/deal/[ref]")
    .replace(/^\/admin\/deals\/(?!wallets(?:\/|$))[^/]+/, "/admin/deals/[ref]");
  return `${u.origin}${path}`;
}

// Loaded after the page (a plain dynamic import, browser only), so
// measuring never slows the page down.
export function SpeedInsights() {
  const [Insights, setInsights] = useState<ComponentType<
    ComponentProps<typeof VercelSpeedInsights>
  > | null>(null);
  useEffect(() => {
    let live = true;
    import("@vercel/speed-insights/next").then((m) => {
      if (live) setInsights(() => m.SpeedInsights);
    });
    return () => {
      live = false;
    };
  }, []);
  return Insights ? (
    <Insights
      beforeSend={(event) => ({ ...event, url: sanitizeVitalsUrl(event.url) })}
    />
  ) : null;
}
