"use client";

import { useSyncExternalStore } from "react";

// True while the media query matches. The server snapshot is false (the
// desktop layout); only use it for things that appear after an interaction,
// such as which side a drawer opens from, so there is no hydration flash.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Phones: drawers become bottom sheets (ui-context.md → Component Library).
export const PHONE_QUERY = "(width < 760px)";
