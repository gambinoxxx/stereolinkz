// Renders the tilted sample board on the (public) login page from a fixture,
// once, to public/login-sample-board.png. The login page never touches the
// database. Re-run after a visual change to the forex template:
//   npm run render:login-sample
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

import { getTemplate } from "@/features/templates/registry";
import { renderSvg } from "@/lib/render/render-svg";
import { forexFixture } from "@/test/board-fixtures";

async function main() {
  const template = getTemplate("forex/purple-signal");
  const svg = await renderSvg(
    (template.render as (s: unknown) => React.ReactElement)(forexFixture()),
  );
  // 500px wide: twice the 250px the login panel shows (sharp on 2× screens).
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 500 },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  const out = join(process.cwd(), "public/login-sample-board.png");
  writeFileSync(out, png);
  console.log(`wrote ${out} (${Math.round(png.byteLength / 1024)} KB)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
