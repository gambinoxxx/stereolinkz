"use client";

import { SpeedInsights as VercelSpeedInsights } from "@vercel/speed-insights/next";

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

export function SpeedInsights() {
  return (
    <VercelSpeedInsights
      beforeSend={(event) => ({ ...event, url: sanitizeVitalsUrl(event.url) })}
    />
  );
}
