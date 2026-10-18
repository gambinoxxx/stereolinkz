"use client";

import { useEffect, useState } from "react";

import { getMarketPrices } from "@/features/deals/public-actions";

const REFRESH_MS = 60_000;

// Live dollar prices for the sell form (the page itself is cached):
// undefined while loading, null when the feed has none. Refreshed every
// minute while the form is open.
export function useMarketPrices(
  enabled: boolean,
): Record<string, string | null> | undefined {
  const [prices, setPrices] = useState<Record<string, string | null>>();
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      getMarketPrices()
        .then((r) => {
          if (live) setPrices(r.ok ? r.data : {});
        })
        .catch(() => {
          if (live) setPrices((p) => p ?? {});
        });
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return prices;
}
