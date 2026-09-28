import "server-only";

import type { ReactNode } from "react";
import satori from "satori";

import { getFonts } from "@/lib/render/fonts";

export const BOARD_WIDTH = 1080;
export const BOARD_HEIGHT = 1920;

export async function renderSvg(element: ReactNode): Promise<string> {
  const fonts = await getFonts();
  return satori(element, { width: BOARD_WIDTH, height: BOARD_HEIGHT, fonts });
}
