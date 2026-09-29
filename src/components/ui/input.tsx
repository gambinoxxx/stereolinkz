import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-control border border-border-input bg-bg-surface px-3 text-[15px] text-text-primary transition-[border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus:border-accent-primary focus:ring-3 focus:ring-accent-primary/14 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-invalid:border-state-error aria-invalid:ring-3 aria-invalid:ring-state-error/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
