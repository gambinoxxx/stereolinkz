// TEMPORARY Phase 1 render spike: proves Satori + resvg produce a correct
// 1080 × 1920 PNG on Vercel. Deleted in Phase 6. (Not named `_spike`:
// App Router never routes folders that start with `_`.)
import { createElement } from "react";

import { ForexPurpleSignal } from "@/features/templates/forex/purple-signal";
import { getMember } from "@/lib/server/auth";
import { renderPng } from "@/lib/render/render-png";
import { renderSvg } from "@/lib/render/render-svg";

import { spikeSnapshot } from "./fixture";

export const runtime = "nodejs";

export async function GET() {
  const member = await getMember();
  if (!member) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (spikeSnapshot.type !== "FOREX") {
    return Response.json({ error: "Fixture must be FOREX" }, { status: 500 });
  }

  const started = performance.now();
  const svg = await renderSvg(
    createElement(ForexPurpleSignal, { snapshot: spikeSnapshot }),
  );
  const png = renderPng(svg);
  const ms = Math.round(performance.now() - started);
  console.log(`[render-spike] ${ms} ms, ${png.byteLength} bytes`);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Render-Ms": String(ms),
    },
  });
}
