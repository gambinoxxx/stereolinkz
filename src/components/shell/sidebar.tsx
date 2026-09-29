import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import Link from "next/link";

import { NavLinks } from "@/components/shell/nav-links";
import { Wordmark } from "@/components/wordmark";
import type { MemberRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export type SidebarUser = { name: string; role: MemberRole };

// Brand, navigation and the signed-in user (dashboard.html .side). Used as
// the fixed desktop sidebar and inside the phone menu drawer.
export function SidebarContent({ user }: { user: SidebarUser }) {
  return (
    <div className="flex h-full flex-col px-3.5 pt-[22px] pb-4 text-sidebar-text [&_:focus-visible]:outline-accent-gold">
      <Link
        href="/admin"
        aria-label="Stereolinkz RateBoard home"
        className="self-start rounded-lg px-2.5"
      >
        <Wordmark size="md" />
      </Link>
      <div className="px-2.5 pt-1.5 text-[12.5px] font-medium text-sidebar-text-muted">
        RateBoard
      </div>

      <NavLinks />

      <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-text-active/8 px-2.5 pt-3">
        <span
          aria-hidden="true"
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-sidebar-avatar text-[14px] font-bold text-sidebar-text-active"
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[14px] font-semibold text-sidebar-text-active">
            {user.name}
          </b>
          <span className="text-[12.5px] text-sidebar-text-muted">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <SignOutButton redirectUrl="/login">
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-sidebar-text-muted transition-colors hover:bg-sidebar-text-active/6 hover:text-sidebar-text-active"
          >
            <LogOut
              aria-hidden="true"
              className="size-[18px]"
              strokeWidth={1.9}
            />
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}

// Fixed 248px sidebar from 900px up.
export function Sidebar({
  user,
  className,
}: {
  user: SidebarUser;
  className?: string;
}) {
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "sticky top-0 z-40 hidden h-screen bg-bg-sidebar shell:block",
        className,
      )}
    >
      <SidebarContent user={user} />
    </aside>
  );
}
