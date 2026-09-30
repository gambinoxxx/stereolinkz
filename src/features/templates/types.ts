import type { ReactElement } from "react";

import type {
  ForexSnapshot,
  PofSnapshot,
} from "@/features/boards/build-snapshot";

export type TemplateType = "FOREX" | "POF";

export type SnapshotOf<T extends TemplateType> = T extends "FOREX"
  ? ForexSnapshot
  : PofSnapshot;

// A board design. Pure (Invariant 4): a validated snapshot in, JSX out;
// no Prisma, fetch, clock or env. Rendered by Satori on the server and by
// BoardFrame in the browser.
export type BoardTemplate<T extends TemplateType = TemplateType> = {
  key: string; // "forex/purple-signal"
  version: number; // bumped when a visual change affects saved boards
  type: T;
  name: string;
  description: string;
  maxRows: number;
  render: (snapshot: SnapshotOf<T>) => ReactElement;
};
