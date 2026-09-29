import { SignOutButton } from "@clerk/nextjs";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/wordmark";
import { requireMember } from "@/lib/server/auth";

// Placeholder shell; the real app shell is Phase 2.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Layouts are NOT a security boundary: they don't re-run on every
  // navigation, and server actions and route handlers bypass them. Every
  // page query, server action and route handler must call requireMember()
  // itself (architecture.md → Invariant 7). This call only keeps
  // non-members from seeing the shell.
  await requireMember();

  return (
    <TooltipProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex h-14 items-center justify-between bg-bg-sidebar px-4">
          <Wordmark className="scale-75 origin-left" />
          <SignOutButton redirectUrl="/login">
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-text hover:text-sidebar-text-active">
              Sign out
            </button>
          </SignOutButton>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-[22px] min-[900px]:px-10 min-[900px]:py-[34px]">
          {children}
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
