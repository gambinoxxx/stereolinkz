"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { isActive, NAV_GROUPS } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

// Sidebar navigation. The active item gets aria-current and the gold marker.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="mt-[26px] flex flex-col gap-0.5">
      {NAV_GROUPS.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div
              role="separator"
              className="mx-3 my-2.5 h-px bg-sidebar-text-active/8"
            />
          )}
          {group.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-control px-3 py-2.5 font-medium text-sidebar-text transition-colors hover:bg-sidebar-text-active/5 hover:text-sidebar-text-active",
                  active &&
                    "bg-sidebar-text-active/9 font-semibold text-sidebar-text-active before:absolute before:inset-y-[9px] before:-left-3.5 before:w-[3px] before:rounded-r-[3px] before:bg-accent-gold",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-[18px] shrink-0"
                  strokeWidth={1.9}
                />
                {label}
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
