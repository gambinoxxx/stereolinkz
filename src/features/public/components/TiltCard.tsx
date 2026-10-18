import type { ReactNode } from "react";

// The school-fees example card. Server markup; the motion (tilting toward
// a fine pointer, or with the scroll, and filling its progress bar once
// half of it is seen) is loaded after the page by LandingMotion. With
// reduced motion the CSS shows it flat with the bar full.
export function TiltCard({ children }: { children: ReactNode }) {
  return (
    <div className="tilt-stage rv" data-motion="tilt">
      <div className="tilt">{children}</div>
    </div>
  );
}
