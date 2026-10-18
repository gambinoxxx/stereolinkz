// The hero's orbiting coins: shared by the server markup (first paint) and
// the motion that moves them (motion/effects.tsx). Pure, no React.

// Decorative coins: symbol, colour class, orbit radius, start angle, speed.
export const HERO_COINS = [
  { sym: "₦", cls: "g", r: 300, a: 200, s: 0.22 },
  { sym: "$", cls: "v", r: 330, a: 330, s: 0.18 },
  { sym: "£", cls: "g s", r: 250, a: 20, s: 0.26 },
  { sym: "₮", cls: "t", r: 360, a: 100, s: 0.15 },
  { sym: "₿", cls: "o s", r: 270, a: 150, s: 0.2 },
  { sym: "Ξ", cls: "b s", r: 345, a: 250, s: 0.24 },
  { sym: "€", cls: "v s", r: 230, a: 290, s: 0.3 },
] as const;

// Where a coin sits at time t (seconds), with the pointer offset and the
// page scroll. Rounded, so the server's first paint matches the browser's.
export function coinTransform(
  k: number,
  t: number,
  scale: number,
  mx = 0,
  my = 0,
  scrollY = 0,
) {
  const c = HERO_COINS[k]!;
  const a = ((c.a + t * c.s * 40) * Math.PI) / 180;
  const x = Math.cos(a) * c.r * scale + mx * (30 + k * 8);
  const y =
    Math.sin(a) * c.r * scale * 0.42 +
    my * (30 + k * 6) -
    scrollY * (0.15 + k * 0.04) -
    90;
  const z = Math.sin(a);
  return {
    transform: `translate(${Math.round(x)}px,${Math.round(y)}px) scale(${(0.8 + z * 0.25).toFixed(3)}) rotate(${Math.round(t * 20 * (k % 2 ? 1 : -1))}deg)`,
    zIndex: z > 0 ? 7 : 1,
    opacity: (0.55 + (0.45 * (z + 1)) / 2).toFixed(3),
  };
}

// Narrow screens use a smaller orbit.
export const orbitScale = () => (window.innerWidth < 860 ? 0.62 : 1);
