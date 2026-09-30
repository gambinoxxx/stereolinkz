import "server-only";

import type { BoardSnapshot } from "@/features/boards/snapshot";
import { getTemplate } from "@/features/templates/registry";
import { embedImages } from "@/lib/render/assets";
import { renderPng } from "@/lib/render/render-png";
import { BOARD_HEIGHT, BOARD_WIDTH, renderSvg } from "@/lib/render/render-svg";

export class TemplateMismatchError extends Error {
  constructor(templateKey: string, snapshotType: string) {
    super(`Template ${templateKey} can't render a ${snapshotType} board`);
    this.name = "TemplateMismatchError";
  }
}

export type RenderedBoard = {
  png: Uint8Array;
  width: number;
  height: number;
  ms: number;
};

// Snapshot → PNG: the only way boards become images (Invariant 8). Logos
// are embedded as data URIs in a copy; the snapshot itself is unchanged.
export async function renderBoardPng(
  snapshot: BoardSnapshot,
  templateKey: string,
): Promise<RenderedBoard> {
  const started = performance.now();
  const template = getTemplate(templateKey);
  if (template.type !== snapshot.type)
    throw new TemplateMismatchError(templateKey, snapshot.type);

  const embedded = await embedImages(snapshot);
  // The type check above guarantees the snapshot fits this template.
  const element = (template.render as (s: BoardSnapshot) => React.ReactElement)(
    embedded,
  );
  const svg = await renderSvg(element);
  const png = new Uint8Array(renderPng(svg));
  return {
    png,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    ms: Math.round(performance.now() - started),
  };
}
