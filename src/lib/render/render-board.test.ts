import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getTemplate } from "@/features/templates/registry";
import {
  renderBoardPng,
  TemplateMismatchError,
} from "@/lib/render/render-board";
import { renderSvg } from "@/lib/render/render-svg";
import { tightenShadowFilters } from "@/lib/render/shadow";
import satori from "satori";
import { getFonts } from "@/lib/render/fonts";
import { forexFixture, pofFixture } from "@/test/board-fixtures";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function ihdr(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return {
    signature: Buffer.from(png.subarray(0, 8)).toString("hex"),
    chunk: Buffer.from(png.subarray(12, 16)).toString("ascii"),
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

describe("renderBoardPng", () => {
  it("renders a 1080 × 1920 PNG, byte-identical on a second run", async () => {
    const first = await renderBoardPng(forexFixture(), "forex/purple-signal");
    expect(ihdr(first.png)).toEqual({
      signature: "89504e470d0a1a0a",
      chunk: "IHDR",
      width: 1080,
      height: 1920,
    });
    expect([first.width, first.height]).toEqual([1080, 1920]);
    const second = await renderBoardPng(forexFixture(), "forex/purple-signal");
    expect(sha256(second.png)).toBe(sha256(first.png));
  }, 60_000);

  it("renders every registered template", async () => {
    for (const key of ["forex/daylight", "pof/purple-signal", "pof/daylight"]) {
      const snapshot = key.startsWith("pof") ? pofFixture() : forexFixture();
      const { png } = await renderBoardPng(snapshot, key);
      expect(ihdr(png).width, key).toBe(1080);
    }
  }, 60_000);

  it("refuses a snapshot of the wrong type", async () => {
    await expect(
      renderBoardPng(pofFixture(), "forex/purple-signal"),
    ).rejects.toThrow(TemplateMismatchError);
  });
});

describe("card shadow region (Phase 1 decision)", () => {
  it("finds Satori's box-shadow filters and shrinks every one", async () => {
    const template = getTemplate("forex/purple-signal");
    const element = (template.render as (s: unknown) => React.ReactElement)(
      forexFixture(),
    );
    // Raw Satori output, before our rewrite: if a Satori upgrade changes
    // the filter shape, this fails and the rewrite needs revisiting.
    const raw = await satori(element, {
      width: 1080,
      height: 1920,
      fonts: await getFonts(),
    });
    const { svg, rewritten } = tightenShadowFilters(raw);
    // Zero-blur shadows (the flags' 5px white ring) cost nothing and are
    // left alone; every blurred one must be rewritten.
    const blurred = [
      ...raw.matchAll(
        /<filter id="satori_s-[^>]+><feGaussianBlur stdDeviation="([\d.]+)"/g,
      ),
    ].filter((m) => Number(m[1]) > 0);
    expect(blurred.length).toBeGreaterThanOrEqual(4); // the card + 3 flags
    expect(rewritten).toBe(blurred.length);
    const widths = (s: string) =>
      [
        ...s.matchAll(
          /<filter id="satori_s-[^"]+" x="[^"]+" y="[^"]+" width="([\d.]+)%"/g,
        ),
      ].map((m) => Number(m[1]));
    const before = widths(raw);
    const after = widths(svg);
    expect(after.filter((w, i) => w < before[i]!)).toHaveLength(rewritten);
    // renderSvg applies it exactly once (Satori's output is deterministic).
    expect(await renderSvg(element)).toBe(svg);
  }, 60_000);
});
