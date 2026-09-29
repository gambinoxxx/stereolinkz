"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// RateBoard: light only (no next-themes). Toasts sit bottom centre with an
// ink background and a gold icon, above the phone tab bar
// (--toast-offset in globals.css).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      offset={{ bottom: "var(--toast-offset)" }}
      mobileOffset={{ bottom: "var(--toast-offset)" }}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--text-primary)",
          "--normal-text": "var(--bg-surface)",
          "--normal-border": "var(--text-primary)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !py-[11px] !px-4 !text-[14px] !font-medium !shadow-xl !shadow-overlay/40",
          icon: "text-accent-gold",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
