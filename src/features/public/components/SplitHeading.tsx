import type { ElementType } from "react";

// A heading whose words slide up when it scrolls into view (MotionRoot adds
// .in). Split on the server, so the markup is the same before and after
// hydration; screen readers get the plain text from aria-label.
export function SplitHeading({
  text,
  as: Tag = "h2",
  id,
}: {
  text: string;
  as?: ElementType;
  id?: string;
}) {
  const words = text.trim().split(/\s+/);
  return (
    <Tag className="split" id={id} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true">
          <span className="w">
            <span style={{ transitionDelay: `${i * 60}ms` }}>{word}</span>
          </span>{" "}
        </span>
      ))}
    </Tag>
  );
}
