import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { MobileMenuProvider } from "@/components/shell/mobile-menu";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { Sidebar, SidebarContent } from "@/components/shell/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getViewer, requireMember } from "@/lib/server/auth";

// App shell (ui-context.md → Layout Patterns): a 248px sidebar from 900px
// up; below that, a sticky top bar, a bottom tab bar, and the sidebar as a
// drawer. Server component; only the nav state is client-side.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Layouts are NOT a security boundary: they don't re-run on every
  // navigation, and server actions and route handlers bypass them. Every
  // page query, server action and route handler must call requireMember()
  // itself (architecture.md → Invariant 7). This call only keeps
  // non-members from seeing the shell.
  const { role } = await requireMember();
  const { fullName } = await getViewer();
  const user = { name: fullName, role };

  return (
    <TooltipProvider>
      <MobileMenuProvider menu={<SidebarContent user={user} />}>
        <div className="min-h-screen shell:grid shell:grid-cols-[248px_minmax(0,1fr)]">
          <Sidebar user={user} />
          <div className="min-w-0">
            <MobileTopBar />
            <main className="mx-auto w-full max-w-[1200px] px-4 pt-[22px] pb-[120px] shell:px-10 shell:pt-[34px] shell:pb-20">
              {children}
            </main>
          </div>
        </div>
        <BottomTabBar />
      </MobileMenuProvider>
      <Toaster />
    </TooltipProvider>
  );
}
