import { SignOutButton } from "@clerk/nextjs";

// Outside /admin on purpose: the admin layout redirects non-members here,
// so living under it would loop.
export default function NotAuthorizedPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg-base px-4 py-8">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-panel border border-border-default bg-bg-surface p-6">
        <h1 className="text-[25px] leading-tight font-[750] tracking-[-0.6px]">
          You don&apos;t have access to RateBoard
        </h1>
        <p className="text-text-secondary">
          The account you signed in with isn&apos;t a member of the Stereolinkz
          team. Sign out and try another account, or ask the owner to add you.
        </p>
        <SignOutButton redirectUrl="/login">
          <button className="h-10 rounded-control bg-accent-primary px-4 text-[14.5px] font-semibold text-primary-foreground hover:bg-accent-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
