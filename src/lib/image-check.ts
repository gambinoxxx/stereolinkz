// Logo checks on the file's bytes, not the browser's MIME type. Pure, so
// the drawer can pre-check on the client and the server re-checks the
// same way (src/lib/server/blob.ts).

export const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB
export const MIN_LOGO_SIDE = 256; // px, raster logos only

export type ImageKind = "png" | "jpeg" | "svg";

export const IMAGE_TYPES: Record<
  ImageKind,
  { contentType: string; ext: string }
> = {
  png: { contentType: "image/png", ext: "png" },
  jpeg: { contentType: "image/jpeg", ext: "jpg" },
  svg: { contentType: "image/svg+xml", ext: "svg" },
};

export const LOGO_ERRORS = {
  type: "Use a PNG, SVG or JPEG logo.",
  size: "The logo must be 1 MB or smaller.",
  small: `The logo must be at least ${MIN_LOGO_SIDE} px on its shortest side.`,
  unsafe:
    "This SVG contains scripts or external links. Export a plain SVG and try again.",
  unreadable: "This image couldn’t be read. Try another file.",
} as const;

export type ImageCheck =
  | { ok: true; kind: ImageKind; width: number | null; height: number | null }
  | { ok: false; error: string };

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  // Signature (8) + IHDR length (4) + "IHDR" (4), then width and height.
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2; // after FF D8
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    const length = view.getUint16(i + 2);
    // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

// Rejects anything that can run or fetch when the SVG is opened directly.
function svgIsUnsafe(text: string): boolean {
  return (
    /<script/i.test(text) ||
    /<foreignObject/i.test(text) ||
    /<!(DOCTYPE|ENTITY)/i.test(text) ||
    /\son[a-z]+\s*=/i.test(text) ||
    /javascript:/i.test(text) ||
    // Only in-document references (#id) are allowed. The lookahead sits
    // after the (optional) quote, so the quote itself can't satisfy it.
    /\b(?:xlink:)?href\s*=\s*(?:"\s*(?!#)|'\s*(?!#)|(?!["'#]))/i.test(text) ||
    /url\(\s*(?:"\s*(?!#)|'\s*(?!#)|(?!["'#]))/i.test(text) ||
    /@import/i.test(text)
  );
}

export function checkImageBytes(bytes: Uint8Array): ImageCheck {
  if (bytes.byteLength > MAX_LOGO_BYTES)
    return { ok: false, error: LOGO_ERRORS.size };

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const size = pngSize(bytes);
    if (!size) return { ok: false, error: LOGO_ERRORS.unreadable };
    if (Math.min(size.width, size.height) < MIN_LOGO_SIDE)
      return { ok: false, error: LOGO_ERRORS.small };
    return { ok: true, kind: "png", ...size };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const size = jpegSize(bytes);
    if (!size) return { ok: false, error: LOGO_ERRORS.unreadable };
    if (Math.min(size.width, size.height) < MIN_LOGO_SIDE)
      return { ok: false, error: LOGO_ERRORS.small };
    return { ok: true, kind: "jpeg", ...size };
  }

  const text = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/^﻿/, "")
    .trimStart();
  if (
    (text.startsWith("<svg") || text.startsWith("<?xml")) &&
    /<svg[\s>]/i.test(text)
  ) {
    if (svgIsUnsafe(text)) return { ok: false, error: LOGO_ERRORS.unsafe };
    return { ok: true, kind: "svg", width: null, height: null };
  }

  return { ok: false, error: LOGO_ERRORS.type };
}
