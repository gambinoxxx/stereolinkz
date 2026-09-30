// Renders every template × fixture to tmp/boards/ with its render time,
// plus a "guides" copy with the board's safe area marked (top 150px and
// bottom 320px, ui-context.md → Board safe area).
//   npm run render:fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getTemplate, listTemplates } from "@/features/templates/registry";
import { embedImages } from "@/lib/render/assets";
import { renderBoardPng } from "@/lib/render/render-board";
import { renderPng } from "@/lib/render/render-png";
import { renderSvg } from "@/lib/render/render-svg";
import { forexFixture, pofFixture, WORST_CASES } from "@/test/board-fixtures";

const OUT = join(process.cwd(), "tmp/boards");
mkdirSync(OUT, { recursive: true });

const GUIDES =
  '<rect x="0" y="149" width="1080" height="2" fill="#FF2D55"/>' +
  '<rect x="0" y="1599" width="1080" height="2" fill="#FF2D55"/>';

type Case = {
  name: string;
  type: "FOREX" | "POF";
  snapshot: () => Parameters<typeof renderBoardPng>[0];
};
const CASES: Case[] = [
  { name: "seed", type: "FOREX", snapshot: forexFixture },
  { name: "seed", type: "POF", snapshot: pofFixture },
  {
    name: "worst-long-prices",
    type: "FOREX",
    snapshot: WORST_CASES["forex-long-prices"],
  },
  {
    name: "worst-long-names",
    type: "POF",
    snapshot: WORST_CASES["pof-long-names"],
  },
];

async function main() {
  const rows: string[] = [];
  for (const c of CASES) {
    for (const template of listTemplates(c.type)) {
      const snapshot = c.snapshot();
      const cold = await renderBoardPng(snapshot, template.key);
      const warm = await renderBoardPng(snapshot, template.key);
      const file = `${template.key.replace("/", "-")}--${c.name}.png`;
      writeFileSync(join(OUT, file), warm.png);

      // Guides copy (the template rendered straight, without logo embedding).
      const element = (
        getTemplate(template.key).render as (
          s: typeof snapshot,
        ) => React.ReactElement
      )(await embedImages(snapshot));
      const svg = (await renderSvg(element)).replace(
        /<\/svg>\s*$/,
        `${GUIDES}</svg>`,
      );
      writeFileSync(
        join(OUT, file.replace(".png", "--guides.png")),
        renderPng(svg),
      );

      rows.push(
        `${file.padEnd(46)} cold ${String(cold.ms).padStart(5)} ms   warm ${String(warm.ms).padStart(5)} ms   ${(warm.png.byteLength / 1024).toFixed(0)} KB`,
      );
    }
  }
  console.log(rows.join("\n"));
  console.log(`\nWritten to ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
