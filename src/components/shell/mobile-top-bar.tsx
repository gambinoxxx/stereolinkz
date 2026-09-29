"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { useOpenMobileMenu } from "@/components/shell/mobile-menu";
import { Wordmark } from "@/components/wordmark";

// Sticky 56px bar under 900px: brand and the menu button.
export function MobileTopBar() {
  const openMenu = useOpenMobileMenu();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-bg-sidebar pr-2 pl-4 text-sidebar-text-active shell:hidden [&_:focus-visible]:outline-accent-gold">
      <Link
        href="/admin"
        aria-label="Stereolinkz RateBoard home"
        className="rounded-lg"
      >
        <Wordmark size="sm" />
      </Link>
      <button
        type="button"
        onClick={openMenu}
        aria-label="Open menu"
        className="grid size-[42px] place-items-center rounded-control"
      >
        <Menu aria-hidden="true" className="size-[22px]" strokeWidth={1.9} />
      </button>
    </header>
  );
}
