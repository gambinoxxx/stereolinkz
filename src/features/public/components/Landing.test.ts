import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Landing } from "@/features/public/components/Landing";
import type { PublicLanding } from "@/features/public/landing-data";
import {
  toCryptoBoard,
  toForexBoard,
  toPofBoard,
} from "@/features/public/landing-data";
import { cryptoFixture, forexFixture, pofFixture } from "@/test/board-fixtures";

const raw = (snapshot: unknown) => ({
  id: "b",
  snapshot,
  snapshotVersion: 1,
  createdAt: new Date("2026-09-27T09:25:00Z"),
  images: [
    {
      blobUrl: "https://x.public.blob.vercel-storage.com/boards/o/b/i.png",
      width: 1080,
      height: 1920,
    },
  ],
});

const org = {
  name: "Stereolinkz",
  logoUrl: null,
  backgroundColor: "#2A0F58",
  primaryColor: "#6A35D9",
  accentColor: "#E9B949",
  contactLine: "+234 903 591 4544",
  email: null,
  timezone: "Africa/Lagos",
};

const render = (data: PublicLanding) =>
  renderToStaticMarkup(createElement(Landing, { data }));

// Text from the design file that must never reach production.
const PLACEHOLDERS = [
  "Placeholder",
  "placeholder",
  "Customer name",
  "Sample",
  "2348000000000",
  "+234 800",
  "hello@example.com",
  "· 9 min",
  ">Terms<",
  ">Privacy<",
  "licensed",
  "regulated",
  "RC number",
];

describe("Landing", () => {
  it("shows the empty states without any board", () => {
    const html = render({ org, forex: null, crypto: null, pof: null });
    expect(html).toContain("Today’s rates are shared on WhatsApp");
    expect(html).toContain("screen-fallback");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("How much will I get?");
    expect(html).not.toMatch(/₦\d/);
  });

  it("shows the boards' rates and images when there are boards", () => {
    const html = render({
      org,
      forex: toForexBoard(raw(forexFixture())),
      crypto: toCryptoBoard(raw(cryptoFixture())),
      pof: toPofBoard(raw(pofFixture())),
    });
    expect(html).toContain('role="tablist"');
    expect(html).toContain("How much will I get?");
    expect(html).toContain(
      "/_next/image?url=https%3A%2F%2Fx.public.blob.vercel-storage.com",
    );
    for (const row of forexFixture().rows) expect(html).toContain(row.code);
  });

  it("puts the Settings number in every WhatsApp link", () => {
    const html = render({
      org,
      forex: toForexBoard(raw(forexFixture())),
      crypto: null,
      pof: null,
    });
    const links = html.match(/href="https:\/\/wa\.me\/[^"]*"/g) ?? [];
    expect(links.length).toBeGreaterThan(5);
    for (const link of links)
      expect(link).toMatch(
        /^href="https:\/\/wa\.me\/2349035914544\?text=Hi%20Stereolinkz/,
      );
  });

  it("never ships the design's placeholders", () => {
    for (const data of [
      { org, forex: null, crypto: null, pof: null },
      {
        org,
        forex: toForexBoard(raw(forexFixture())),
        crypto: toCryptoBoard(raw(cryptoFixture())),
        pof: toPofBoard(raw(pofFixture())),
      },
    ]) {
      const html = render(data);
      for (const text of PLACEHOLDERS) expect(html, text).not.toContain(text);
      // Hidden until real content is given.
      expect(html).not.toContain("Hear it from our clients");
      expect(html).not.toContain("How fast will I be paid?");
    }
  });
});
