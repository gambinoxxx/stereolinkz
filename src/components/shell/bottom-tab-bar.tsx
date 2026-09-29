"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useOpenMobileMenu } from "@/components/shell/mobile-menu";
import { isActive, TAB_ITEMS } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

const tab =
  "flex flex-col items-center gap-[3px] px-0.5 py-[5px] text-[11px] font-semibold text-text-muted";

// Fixed tab bar under 900px: Home, Forex, POF, a raised Generate, and More
// (the full menu). Clears the iPhone home indicator.
export function BottomTabBar() {
  const pathname = usePathname();
  const openMenu = useOpenMobileMenu();

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border-default bg-bg-surface/97 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-[8px] shell:hidden"
    >
      {TAB_ITEMS.map(({ href, label, icon: Icon, raised }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(tab, active && "text-accent-primary")}
          >
            {raised ? (
              <span className="-mt-0.5 grid h-[30px] w-10 place-items-center rounded-control bg-accent-primary text-primary-foreground">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
              </span>
            ) : (
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
            )}
            {label}
          </Link>
        );
      })}
      <button type="button" onClick={openMenu} className={tab}>
        <Ellipsis aria-hidden="true" className="size-5" strokeWidth={1.9} />
        More
      </button>
    </nav>
  );
}
