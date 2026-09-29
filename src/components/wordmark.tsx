import { cn } from "@/lib/utils";

// Sizes from docs/design: login panel (lg), sidebar (md), phone top bar (sm).
const SIZES = {
  lg: { bars: [13, 23, 30, 18], barWidth: 6, text: "text-[26px]" },
  md: { bars: [11, 19, 24, 15], barWidth: 5, text: "text-[21px]" },
  sm: { bars: [10, 17, 21, 13], barWidth: 5, text: "text-[19px]" },
} as const;

// Equalizer bars plus "stereolinkz" wordmark, until the logo file exists.
export function Wordmark({
  size = "lg",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { bars, barWidth, text } = SIZES[size];
  return (
    <span className={cn("flex items-end gap-2.5", className)}>
      <span
        className="flex items-end gap-[3px]"
        style={{ height: Math.max(...bars) }}
        aria-hidden="true"
      >
        {bars.map((h, i) => (
          <i
            key={i}
            className="block rounded-[3px] bg-accent-gold"
            style={{ height: h, width: barWidth }}
          />
        ))}
      </span>
      <span
        className={cn(
          "leading-none font-extrabold tracking-[-0.5px] text-sidebar-text-active font-stretch-[112%]",
          text,
        )}
      >
        stereo<b className="font-extrabold text-accent-gold">linkz</b>
      </span>
    </span>
  );
}
