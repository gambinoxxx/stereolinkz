// Bundled flag SVGs (emoji flags render unreliably in SVG), keyed by
// Currency.flagCode. All are drawn in a square 60×60 viewBox because
// boards show them cropped to a circle.
// us, gb and eu follow docs/design/stereolinkz-rate-boards.html; ca, cn
// and ng are simplified versions in the same style.

function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.382;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `<polygon points="${points.join(" ")}"/>`;
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">${body}</svg>`;

const FLAGS: Record<string, string> = {
  us: svg(
    `<rect width="60" height="60" fill="#fff"/>` +
      `<g fill="#C8102E">${[0, 9.2, 18.4, 27.6, 36.8, 46, 55.2]
        .map((y) => `<rect y="${y}" width="60" height="4.8"/>`)
        .join("")}</g>` +
      `<rect width="30" height="32.2" fill="#0A3161"/>` +
      `<g fill="#fff">${[
        [6, 6],
        [15, 6],
        [24, 6],
        [10.5, 12],
        [19.5, 12],
        [6, 18],
        [15, 18],
        [24, 18],
        [10.5, 24],
        [19.5, 24],
      ]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="1.6"/>`)
        .join("")}</g>`,
  ),
  gb: svg(
    `<rect width="60" height="60" fill="#012169"/>` +
      `<path d="M0 0 60 60M60 0 0 60" stroke="#fff" stroke-width="12"/>` +
      `<path d="M0 0 60 60M60 0 0 60" stroke="#C8102E" stroke-width="4"/>` +
      `<path d="M30 0v60M0 30h60" stroke="#fff" stroke-width="18"/>` +
      `<path d="M30 0v60M0 30h60" stroke="#C8102E" stroke-width="10"/>`,
  ),
  eu: svg(
    `<rect width="60" height="60" fill="#003399"/>` +
      `<g fill="#FFCC00">${Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return star(30 + 17 * Math.sin(a), 30 - 17 * Math.cos(a), 3);
      }).join("")}</g>`,
  ),
  ca: svg(
    `<rect width="60" height="60" fill="#fff"/>` +
      `<rect width="15" height="60" fill="#D52B1E"/>` +
      `<rect x="45" width="15" height="60" fill="#D52B1E"/>` +
      `<polygon fill="#D52B1E" points="30,14 27,20 24,19 25,27 20,23 19,26 16,25 18,31 16,32 23,37 22,40 29,39 29,46 31,46 31,39 38,40 37,37 44,32 42,31 44,25 41,26 40,23 35,27 36,19 33,20"/>`,
  ),
  cn: svg(
    `<rect width="60" height="60" fill="#EE1C25"/>` +
      `<g fill="#FFFF00">${star(14, 16, 8)}${star(26, 7, 2.6)}${star(31, 12, 2.6)}${star(31, 19, 2.6)}${star(26, 24, 2.6)}</g>`,
  ),
  ng: svg(
    `<rect width="60" height="60" fill="#fff"/>` +
      `<rect width="20" height="60" fill="#008751"/>` +
      `<rect x="40" width="20" height="60" fill="#008751"/>`,
  ),
};

export function hasFlag(code: string | null | undefined): code is string {
  return !!code && code in FLAGS;
}

// data: URI for <img>. btoa works on the server and in the browser preview.
export function flagDataUri(code: string): string | null {
  const flag = FLAGS[code];
  return flag ? `data:image/svg+xml;base64,${btoa(flag)}` : null;
}

// Picker labels, in the order the add-currency drawer lists them
// (forex-add.html). Keyed by flag code, like the SVGs above.
export const FLAG_OPTIONS = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "eu", label: "European Union" },
  { code: "ca", label: "Canada" },
  { code: "cn", label: "China" },
  { code: "ng", label: "Nigeria" },
] as const;

export type FlagCode = (typeof FLAG_OPTIONS)[number]["code"];

export const FLAG_CODES = FLAG_OPTIONS.map((flag) => flag.code) as [
  FlagCode,
  ...FlagCode[],
];
