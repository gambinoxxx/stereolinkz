"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

// Signed-in admin pages only: registers the notifications service worker
// (public/sw.js, which caches nothing) and keeps the app icon's badge at
// the number of deals needing action, cleared while Deals is open. Both are
// feature-detected and skipped quietly where unsupported.
export function AppServiceWorker({ needsAction }: { needsAction: number }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}); // no worker: no notifications, nothing else changes
  }, []);

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    const onDeals = pathname.startsWith("/admin/deals");
    (onDeals || needsAction === 0
      ? nav.clearAppBadge()
      : nav.setAppBadge(needsAction)
    ).catch(() => {});
  }, [pathname, needsAction]);

  return null;
}
