import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type InputAddonProps = Omit<ComponentProps<"input">, "prefix" | "size"> & {
  prefix?: string; // "₦"
  suffix?: string; // "%"
  // The value differs from the saved one (gold, as in generator-edited.html).
  changed?: boolean;
  // sm (38px) is for dense rows such as the generator's rate list.
  size?: "default" | "sm";
};

const addon =
  "flex items-center bg-bg-subtle font-semibold text-text-muted select-none";

// A numeric input with a unit on either side (docs/design .ig).
export function InputAddon({
  prefix,
  suffix,
  changed = false,
  size = "default",
  className,
  ...props
}: InputAddonProps) {
  return (
    <div
      data-changed={changed || undefined}
      className={cn(
        "flex h-[42px] items-stretch overflow-hidden rounded-control border border-border-input bg-bg-surface transition-[border-color,box-shadow]",
        "focus-within:border-accent-primary focus-within:ring-3 focus-within:ring-accent-primary/14",
        "has-[input[aria-invalid=true]]:border-state-error has-[input:disabled]:bg-bg-subtle",
        changed &&
          "border-accent-gold bg-accent-gold-soft/40 ring-3 ring-accent-gold/20 focus-within:border-accent-gold focus-within:ring-accent-gold/30",
        size === "sm" && "h-[38px]",
        className,
      )}
    >
      {prefix && (
        <span
          aria-hidden="true"
          className={cn(
            addon,
            "border-r border-border-default",
            size === "sm" ? "px-[9px]" : "px-[11px]",
          )}
        >
          {prefix}
        </span>
      )}
      <input
        className={cn(
          "w-full min-w-0 border-0 bg-transparent font-semibold text-text-primary tabular-nums outline-none disabled:cursor-not-allowed disabled:text-text-secondary",
          size === "sm" ? "px-2.5 text-[15px]" : "px-3 text-base",
        )}
        {...props}
      />
      {suffix && (
        <span
          aria-hidden="true"
          className={cn(
            addon,
            "border-l border-border-default",
            size === "sm" ? "px-[9px]" : "px-[11px]",
          )}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
