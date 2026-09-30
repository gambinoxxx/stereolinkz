import "server-only";

import type { ReactNode } from "react";
import satori from "satori";

import { getFonts } from "@/lib/render/fonts";
import { tightenShadowFilters } from "@/lib/render/shadow";

export const BOARD_WIDTH = 1080;
export const BOARD_HEIGHT = 1920;

export async function renderSvg(element: ReactNode): Promise<string> {
  const fonts = await getFonts();
  const svg = await satori(element, {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    fonts,
  });
  return tightenShadowFilters(svg).svg;
}
