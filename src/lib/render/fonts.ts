import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Keep in sync with scripts/copy-fonts.mjs.
const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
// Templates ask for "Archivo". The latin file covers everything except ₦,
// which only latin-ext has. Satori falls back per glyph only between fonts
// with different names (two files both named "Archivo" never fall back;
// verified in the Phase 1 spike), so latin-ext is registered separately.
const SUBSETS = [
  { file: "latin", name: "Archivo" },
  { file: "latin-ext", name: "Archivo latin-ext" },
] as const;

type FontWeight = (typeof WEIGHTS)[number];

export type SatoriFont = {
  name: string;
  data: Buffer;
  weight: FontWeight;
  style: "normal";
};

const FONT_DIR = join(process.cwd(), "assets/fonts");

async function loadFonts(): Promise<SatoriFont[]> {
  const fonts = await Promise.all(
    WEIGHTS.flatMap((weight) =>
      SUBSETS.map(async (subset) => ({
        name: subset.name,
        data: await readFile(
          join(FONT_DIR, `archivo-${subset.file}-${weight}-normal.woff`),
        ),
        weight,
        style: "normal" as const,
      })),
    ),
  );
  return fonts;
}

// Read once per server instance.
let fontsPromise: Promise<SatoriFont[]> | undefined;

export function getFonts(): Promise<SatoriFont[]> {
  fontsPromise ??= loadFonts().catch((error: unknown) => {
    fontsPromise = undefined; // let the next call retry
    throw error;
  });
  return fontsPromise;
}
