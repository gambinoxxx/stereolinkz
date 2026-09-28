import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/wordmark";

// Placeholder shell; the real app shell is Phase 2.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  return (
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
  );
}
