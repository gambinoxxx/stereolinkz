// Copies the Archivo WOFF files Satori needs from @fontsource/archivo into
// assets/fonts/. Satori reads WOFF (not WOFF2). Both subsets are needed:
// ₦ only exists in latin-ext. Run after upgrading @fontsource/archivo:
//   node scripts/copy-fonts.mjs
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@fontsource/archivo/files");
const to = join(root, "assets/fonts");

const WEIGHTS = [400, 500, 600, 700, 800, 900];
const SUBSETS = ["latin", "latin-ext"];

mkdirSync(to, { recursive: true });
for (const subset of SUBSETS) {
  for (const weight of WEIGHTS) {
    const file = `archivo-${subset}-${weight}-normal.woff`;
    const source = join(from, file);
    if (!existsSync(source)) throw new Error(`Missing ${source}`);
    copyFileSync(source, join(to, file));
    console.log(`copied ${file}`);
  }
}
