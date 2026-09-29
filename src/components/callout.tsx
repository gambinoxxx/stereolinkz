import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CalloutProps = {
  tone?: "info" | "warn"; // violet soft, or gold soft for "will be saved"
  children: ReactNode;
  className?: string;
};

// docs/design .note-box
export function Callout({ tone = "info", children, className }: CalloutProps) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-control px-3.5 py-3 text-[13.5px] leading-[1.45]",
        tone === "info"
          ? "bg-accent-soft text-accent-primary-hover"
          : "bg-accent-gold-soft text-accent-gold-text",
        className,
      )}
    >
      <Info
        aria-hidden="true"
        className="mt-px size-4 shrink-0"
        strokeWidth={1.9}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
