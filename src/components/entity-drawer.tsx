"use client";

import { Loader2, X } from "lucide-react";
import { useRef, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";

type EntityDrawerProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode; // optional button that opens the drawer
  title: string;
  description?: string;
  children: ReactNode; // the form fields
  submitLabel: string; // "Save changes"
  pendingLabel?: string; // "Saving…"
  pending?: boolean;
  submitDisabled?: boolean;
  onSubmit?: ComponentProps<"form">["onSubmit"];
  action?: ComponentProps<"form">["action"];
};

// Edit flows open in a drawer over the table (ui-context.md → Layout
// Patterns): 460px from the right on desktop, a bottom sheet on phones.
// The body is a <form>, so Enter submits; Escape and Cancel close it, and
// Radix returns focus to whatever opened it.
export function EntityDrawer({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  submitLabel,
  pendingLabel,
  pending = false,
  submitDisabled = false,
  onSubmit,
  action,
}: EntityDrawerProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side={isPhone ? "bottom" : "right"}
        showCloseButton={false}
        {...(description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(event) => {
          // Start in the first field rather than on the close button.
          const field = formRef.current?.querySelector<HTMLElement>(
            "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role=combobox]",
          );
          if (field) {
            event.preventDefault();
            field.focus();
          }
        }}
      >
        <form
          ref={formRef}
          onSubmit={onSubmit}
          action={action}
          aria-busy={pending || undefined}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetHeader className="flex-row items-start justify-between gap-3 pr-[22px]">
            <div className="min-w-0">
              <SheetTitle>{title}</SheetTitle>
              {description && (
                <SheetDescription className="mt-0.5">
                  {description}
                </SheetDescription>
              )}
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X strokeWidth={1.9} />
              </Button>
            </SheetClose>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
            {children}
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={pending || submitDisabled}>
              {pending && (
                <Loader2 aria-hidden="true" className="animate-spin" />
              )}
              {pending ? (pendingLabel ?? submitLabel) : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
