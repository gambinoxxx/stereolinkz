import "server-only";

import { Resvg } from "@resvg/resvg-js";

import { BOARD_WIDTH } from "@/lib/render/render-svg";

// Satori outputs text as paths, so resvg needs no fonts. Skipping the
// system font scan saves ~2.3 s per render (measured in the Phase 1 spike).
export function renderPng(svg: string): Buffer {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: BOARD_WIDTH },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
}
