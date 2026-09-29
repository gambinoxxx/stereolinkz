import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string; // one line: what to do next
  action?: ReactNode;
  className?: string;
};

// Dashed card, as the "More designs" card in templates.html.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-60 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-border-input px-6 py-8 text-center text-text-secondary",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className="size-[26px] text-text-muted"
        strokeWidth={1.9}
      />
      <p className="mt-1 font-bold text-text-primary">{title}</p>
      <p className="max-w-[46ch] text-[13.5px]">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
