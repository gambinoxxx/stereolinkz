"use client";

import { useSyncExternalStore } from "react";

import { updatedLabel } from "@/features/public/updated-label";

const noop = () => () => {};

// "Updated today, 10:25 AM" or "Updated Fri 9 Oct, 10:25 AM". The page is
// cached for up to an hour, so "today" is worked out in the browser. The
// server (and hydration) shows the board's own time.
export function UpdatedLabel({
  createdAt,
  timeZone,
  timeLabel,
}: {
  createdAt: string;
  timeZone: string;
  timeLabel: string;
}) {
  const label = useSyncExternalStore(
    noop,
    () => updatedLabel(new Date(createdAt), new Date(), timeZone),
    () => `Updated ${timeLabel}`,
  );
  return <>{label}</>;
}
