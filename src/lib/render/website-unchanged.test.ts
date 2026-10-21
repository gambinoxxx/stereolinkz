import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { boardSnapshotV1 } from "@/features/boards/snapshot";
import { renderBoardPng } from "@/lib/render/render-board";
import real from "@/test/fixtures/real-snapshots.json";

// Template version 2 added the website to the small print. Boards stored
// before it have no website and must render exactly as they did: these
// PNGs were rendered from the same stored snapshots by the version 1 code
// (before commit c93c5b8), and today's code must match them byte for byte.
// Rendering is slow on a cold start (fonts), so more than the 5 s default.
describe(
  "boards made before the website was added",
  { timeout: 30_000 },
  () => {
    for (const board of [real.forex, real.pof]) {
      const snapshot = boardSnapshotV1.parse(board.snapshot);
      const type = snapshot.type.toLowerCase();
      it(`renders the stored ${type} board byte-identical`, async () => {
        const before = readFileSync(
          new URL(
            `../../test/fixtures/pre-website-${type}.png`,
            import.meta.url,
          ),
        );
        const { png } = await renderBoardPng(snapshot, `${type}/purple-signal`);
        expect(Buffer.from(png).equals(before)).toBe(true);
      });
    }
  },
);
