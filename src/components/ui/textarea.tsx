import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[84px] w-full resize-y rounded-control border border-border-input bg-bg-surface px-3 py-2.5 text-[15px] leading-[1.4] text-text-primary transition-[border-color,box-shadow] outline-none placeholder:text-text-muted focus:border-accent-primary focus:ring-3 focus:ring-accent-primary/14 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-invalid:border-state-error aria-invalid:ring-3 aria-invalid:ring-state-error/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
