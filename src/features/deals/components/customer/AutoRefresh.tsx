"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-reads the deal every 20 s while the page is open and visible, so the
// customer sees each step as the team moves the deal. Paused when hidden.
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let id: number | undefined;
    const start = () => {
      if (id === undefined && document.visibilityState === "visible")
        id = window.setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // catch up at once
        start();
      } else stop();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);
  return null;
}
