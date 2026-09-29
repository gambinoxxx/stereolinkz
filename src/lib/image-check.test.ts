import { describe, expect, it } from "vitest";

import {
  checkImageBytes,
  LOGO_ERRORS,
  MAX_LOGO_BYTES,
} from "@/lib/image-check";

// Tiny fixtures: only the header bytes the checks read.
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  const app0 = [
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ];
  return new Uint8Array([
    0xff,
    0xd8,
    ...app0,
    ...sof0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

const text = (s: string) => new TextEncoder().encode(s);

describe("checkImageBytes", () => {
  it("accepts a 256px PNG and reads its size", () => {
    expect(checkImageBytes(png(256, 300))).toEqual({
      ok: true,
      kind: "png",
      width: 256,
      height: 300,
    });
  });

  it("rejects a PNG under 256px on its shortest side", () => {
    expect(checkImageBytes(png(100, 100))).toEqual({
      ok: false,
      error: LOGO_ERRORS.small,
    });
  });

  it("reads a JPEG's frame size", () => {
    expect(checkImageBytes(jpeg(512, 400))).toMatchObject({
      ok: true,
      kind: "jpeg",
      width: 512,
      height: 400,
    });
    expect(checkImageBytes(jpeg(512, 200))).toEqual({
      ok: false,
      error: LOGO_ERRORS.small,
    });
  });

  it("rejects a GIF, whatever its name or MIME type", () => {
    expect(checkImageBytes(text("GIF89a\x01\x00\x01\x00"))).toEqual({
      ok: false,
      error: LOGO_ERRORS.type,
    });
  });

  it("rejects a file over 1 MB", () => {
    const big = png(512, 512);
    const padded = new Uint8Array(MAX_LOGO_BYTES + 1);
    padded.set(big);
    expect(checkImageBytes(padded)).toEqual({
      ok: false,
      error: LOGO_ERRORS.size,
    });
  });

  it("accepts a clean SVG, with or without an XML prolog", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><use href="#g"/><rect fill="url(#g)" width="10" height="10"/></svg>';
    expect(checkImageBytes(text(svg))).toEqual({
      ok: true,
      kind: "svg",
      width: null,
      height: null,
    });
    expect(
      checkImageBytes(text(`﻿<?xml version="1.0"?>\n${svg}`)),
    ).toMatchObject({
      ok: true,
      kind: "svg",
    });
  });

  it("rejects SVGs that can run code or load anything", () => {
    const unsafe = [
      "<svg><script>alert(1)</script></svg>",
      '<svg onload="alert(1)"></svg>',
      "<svg><foreignObject><div/></foreignObject></svg>",
      '<svg><image href="https://example.com/x.png"/></svg>',
      '<svg><a xlink:href="javascript:alert(1)"/></svg>',
      '<svg><rect fill="url(https://example.com/p.svg#x)"/></svg>',
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    ];
    for (const svg of unsafe) {
      expect(checkImageBytes(text(svg)), svg).toEqual({
        ok: false,
        error: LOGO_ERRORS.unsafe,
      });
    }
  });

  it("rejects text that is not an SVG", () => {
    expect(checkImageBytes(text("<html><body/></html>"))).toEqual({
      ok: false,
      error: LOGO_ERRORS.type,
    });
  });
});
