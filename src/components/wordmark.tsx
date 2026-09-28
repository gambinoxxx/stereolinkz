import { cn } from "@/lib/utils";

const BAR_HEIGHTS = [13, 23, 30, 18];

// Equalizer bars plus "stereolinkz" wordmark, until the logo file exists.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-end gap-2.5", className)}>
      <span className="flex h-[30px] items-end gap-[3px]" aria-hidden="true">
        {BAR_HEIGHTS.map((h) => (
          <i
            key={h}
            className="block w-1.5 rounded-[3px] bg-accent-gold"
            style={{ height: h }}
          />
        ))}
      </span>
      <span className="text-[26px] leading-none font-extrabold tracking-[-0.5px] text-white font-stretch-[112%]">
        stereo<b className="font-extrabold text-accent-gold">linkz</b>
      </span>
    </span>
  );
}
