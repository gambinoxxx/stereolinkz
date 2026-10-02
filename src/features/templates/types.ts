import type { ReactElement } from "react";

import type {
  CryptoSnapshot,
  ForexSnapshot,
  PofSnapshot,
} from "@/features/boards/build-snapshot";
import type { BoardType } from "@/features/boards/defaults";
import type { ThemeName } from "@/features/templates/theme";

export type TemplateType = BoardType;

export type SnapshotOf<T extends TemplateType> = {
  FOREX: ForexSnapshot;
  POF: PofSnapshot;
  CRYPTO: CryptoSnapshot;
}[T];

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
  theme: ThemeName; // its colour set, for swatches (the generator's template step)
  render: (snapshot: SnapshotOf<T>) => ReactElement;
};
