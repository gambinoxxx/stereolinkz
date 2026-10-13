import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Pieces shared by the settings tabs (General, Deal desk): settings.html
// .set sections, the native select and the field error line.

const selectClass =
  "h-[42px] w-full appearance-none pr-9 min-w-0 rounded-control border border-border-input bg-bg-surface px-3 text-[15px] text-text-primary outline-none focus:border-accent-primary focus:ring-3 focus:ring-accent-primary/14 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-invalid:border-state-error";

export function Section({
  title,
  description,
  soon,
  children,
}: {
  title: string;
  description: string;
  soon?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-3.5 border-t border-border-default py-[26px] first-of-type:border-t-0 first-of-type:pt-0 shell:grid-cols-[260px_minmax(0,1fr)] shell:gap-8",
        soon && "opacity-60",
      )}
    >
      <div>
        <h2 className="text-[16.5px] font-bold">{title}</h2>
        <p className="mt-1 text-[13.5px] text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-panel border border-border-default bg-bg-surface p-[22px]">
        {children}
      </div>
    </section>
  );
}

// A native select (long lists, phone pickers) with the design's chevron.
export function Select(props: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={selectClass} />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
        strokeWidth={1.9}
      />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13.5px] font-medium text-state-error">
      {message}
    </p>
  );
}
