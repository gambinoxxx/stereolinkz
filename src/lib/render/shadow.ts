// Card shadow decision (Phase 1 close-out, option 2): keep the designed
// box-shadows, but shrink the filter region Satori gives them.
//
// Satori 0.33 reserves blur²/4 px around the element for a box-shadow
// (the card's 60px blur → 900px on every side), and resvg blurs that whole
// area: ~2 s per board. A Gaussian with stdDeviation σ (= blur / 2) reaches
// only ~3σ, so a 3σ margin draws the same shadow at a fraction of the cost.
//
// Satori writes the region as percentages of the element box:
//   x = −m/w·100%,  width = (w + 2m)/w·100%,  with m = σ² (no spread)
// so from σ and the percentages we get w (and h), then rewrite the region
// with m = 3σ. Filters that don't match this shape are left untouched; the
// render test fails if a Satori upgrade stops producing them. Apply it once
// per render (renderSvg does): a rewritten region still fits the pattern.

const FILTER =
  /<filter id="(satori_s-[^"]+)" x="(-?[\d.]+)%" y="(-?[\d.]+)%" width="([\d.]+)%" height="([\d.]+)%"><feGaussianBlur stdDeviation="([\d.]+)"/g;

const pct = (value: number) => `${Number(value.toFixed(4))}%`;

export type ShadowRewrite = { svg: string; rewritten: number };

export function tightenShadowFilters(svg: string): ShadowRewrite {
  let rewritten = 0;
  const out = svg.replace(
    FILTER,
    (
      match,
      id: string,
      xs: string,
      ys: string,
      ws: string,
      hs: string,
      sds: string,
    ) => {
      const sigma = Number(sds);
      const x = Number(xs);
      const y = Number(ys);
      const satoriMargin = sigma * sigma;
      // Only Satori's own box-shadow shape (margin = σ², negative offsets).
      if (sigma <= 0 || x >= 0 || y >= 0) return match;
      const w = satoriMargin / (-x / 100);
      const h = satoriMargin / (-y / 100);
      const expectedWidth = ((w + 2 * satoriMargin) / w) * 100;
      if (Math.abs(expectedWidth - Number(ws)) > 0.5) return match;
      if (Math.abs(((h + 2 * satoriMargin) / h) * 100 - Number(hs)) > 0.5)
        return match;

      const m = 3 * sigma;
      rewritten++;
      return `<filter id="${id}" x="${pct((-m / w) * 100)}" y="${pct((-m / h) * 100)}" width="${pct(((w + 2 * m) / w) * 100)}" height="${pct(((h + 2 * m) / h) * 100)}"><feGaussianBlur stdDeviation="${sds}"`;
    },
  );
  return { svg: out, rewritten };
}
