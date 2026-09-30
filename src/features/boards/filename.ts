// Download names for board PNGs: "<brand>-<type>-<time>.png", for example
// "stereolinkz-forex-1025am.png". The brand comes from the snapshot (the
// org name at generation time), the time from its timeLabel. Pure.
import type { BoardType } from "@/features/boards/defaults";

function slug(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function boardFilename(
  brandName: string,
  type: BoardType,
  timeLabel: string,
): string {
  const time = timeLabel.toLowerCase().replace(/[^0-9apm]/g, "");
  return [slug(brandName) || "board", type.toLowerCase(), time]
    .filter(Boolean)
    .join("-")
    .concat(".png");
}
