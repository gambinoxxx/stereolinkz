import { content } from "@/features/public/content";

const BARS = [9, 15, 21, 12];

// The animated logo bars and "stereo" + gold "linkz", as on the boards.
// scale sizes the bars with the font size.
export function Wordmark({
  scale = 1,
  className = "",
}: {
  scale?: number;
  className?: string;
}) {
  return (
    <span className={`logo ${className}`}>
      <span className="bars" aria-hidden="true">
        {BARS.map((h, i) => (
          <i key={i} style={{ height: Math.round(h * scale) }} />
        ))}
      </span>
      <span className="wm">
        {content.wordmark.lead}
        <b>{content.wordmark.accent}</b>
      </span>
    </span>
  );
}
