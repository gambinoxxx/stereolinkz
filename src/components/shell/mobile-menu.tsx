"use client";

import {
  createContext,
  useContext,
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
// Escape, the overlay and following a link close it; Radix returns focus to
// the button that opened it.
export function MobileMenuProvider({
  menu,
  children,
}: {
  menu: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function closeOnLink(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <OpenMenuContext.Provider value={() => setOpen(true)}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          showCloseButton={false}
          onClick={closeOnLink}
          className="border-0 bg-bg-sidebar shell:hidden"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {menu}
        </SheetContent>
      </Sheet>
    </OpenMenuContext.Provider>
  );
}
