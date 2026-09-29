import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// RateBoard: sizes and variants follow docs/design (.btn). Default 40px,
// sm 32px, icon 34px; primary violet, outline, ghost, destructive.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-semibold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-accent-primary bg-accent-primary text-primary-foreground hover:border-accent-primary-hover hover:bg-accent-primary-hover",
        outline:
          "border-border-default bg-bg-surface text-text-primary hover:border-border-hover hover:bg-bg-subtle",
        ghost:
          "border-transparent bg-transparent text-text-primary hover:bg-bg-hover",
        destructive:
          "border-state-error bg-state-error text-primary-foreground hover:bg-state-error/90",
        link: "border-0 text-[14px] text-accent-primary hover:underline",
      },
      size: {
        default: "h-10 px-4 text-[14.5px]",
        sm: "h-8 rounded-lg px-[11px] text-[13.5px]",
        icon: "size-[34px] p-0",
      },
    },
    // Size classes come after variant classes, so link resets them here.
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
