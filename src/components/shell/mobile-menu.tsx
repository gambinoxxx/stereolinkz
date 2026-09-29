"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const OpenMenuContext = createContext<() => void>(() => {});

// Opens the phone menu drawer (the sidebar, from the left).
export function useOpenMobileMenu() {
  return useContext(OpenMenuContext);
}

// Holds the phone menu's open state, so the top bar's menu button and the
// tab bar's More open the same drawer. `menu` is the sidebar content.
// Escape, the overlay and following a link close it. The drawer has no
// SheetTrigger (two buttons open it), so Radix can't return focus by
// itself: we remember the opener and refocus it, except after a link,
// where focus belongs to the new page.
export function MobileMenuProvider({
  menu,
  children,
}: {
  menu: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const closedByLinkRef = useRef(false);

  function openMenu() {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closedByLinkRef.current = false;
    setOpen(true);
  }

  function closeOnLink(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) {
      closedByLinkRef.current = true;
      setOpen(false);
    }
  }

  function restoreFocus(event: Event) {
    const opener = openerRef.current;
    if (closedByLinkRef.current || !opener?.isConnected) return;
    event.preventDefault();
    opener.focus();
  }

  return (
    <OpenMenuContext.Provider value={openMenu}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          showCloseButton={false}
          onClick={closeOnLink}
          onCloseAutoFocus={restoreFocus}
          className="border-0 bg-bg-sidebar shell:hidden"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {menu}
        </SheetContent>
      </Sheet>
    </OpenMenuContext.Provider>
  );
}
