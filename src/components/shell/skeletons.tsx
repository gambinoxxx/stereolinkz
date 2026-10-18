import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading skeletons for the admin pages (loading.tsx). Each piece copies
// the size and spacing of the real one (PageHeader, the stat cards, Panel,
// the rate and deal tables), so nothing moves when the data arrives.
// Decorative: the page announces itself as busy instead.

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

// PageHeader: a 25 / 30px title, a one- or two-line description and the
// actions (full width on phones).
export function HeaderSkeleton({
  title = "w-[200px]",
  lines = 1,
  actions = [],
}: {
  title?: string;
  lines?: 1 | 2;
  actions?: string[]; // button widths, e.g. "w-[150px]"
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 shell:mb-[26px]">
      <div className="w-full max-w-[62ch] shell:w-auto shell:min-w-[420px]">
        <Line height="h-[27.5px] shell:h-[33px]" width={title} />
        <div className="mt-1.5">
          <Line height="h-[22px]" width="w-full max-w-[520px]" />
          {lines === 2 && <Line height="h-[22px]" width="w-[60%]" />}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex w-full flex-wrap gap-2.5 *:flex-1 shell:w-auto shell:*:flex-none">
          {actions.map((w, i) => (
            <Skeleton key={i} className={cn("h-10 rounded-control", w)} />
          ))}
        </div>
      )}
    </div>
  );
}

// A row of bordered stat cards (deals.html .stats).
export function StatCardsSkeleton({
  count = 4,
  className = "grid-cols-2 wide:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("mb-[22px] grid gap-3.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-panel border border-border-default bg-bg-surface px-[18px] py-4"
        >
          <Skeleton className="h-[15px] w-[70%]" />
          <Skeleton className="mt-[9px] h-[28px] w-12" />
          <Skeleton className="mt-[7px] h-[14px] w-[55%]" />
        </div>
      ))}
    </div>
  );
}

// The segmented All / Active / Inactive control (or the deals filters).
export function TabsSkeleton({ width = "w-[202px]" }: { width?: string }) {
  return <Skeleton className={cn("h-[38px] rounded-[11px]", width)} />;
}

// A bordered panel with a title bar (Panel in deals/components/admin).
export function PanelSkeleton({
  title = "w-[140px]",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-panel border border-border-default bg-bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <Skeleton className={cn("h-[20px]", title)} />
      </div>
      <div className="px-5 py-[18px]">{children}</div>
    </section>
  );
}

// Label / value lines inside a panel.
export function LinesSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <Skeleton className="h-[16px] w-[35%]" />
          <Skeleton className="h-[16px] w-[30%]" />
        </div>
      ))}
    </div>
  );
}

// A list table: a header strip, then rows with a round mark, a name and
// sub-line, and a value on the right (rate tables, deals queue).
export function TableSkeleton({
  rows = 6,
  rowHeight = "h-[73px]",
  header = true,
}: {
  rows?: number;
  rowHeight?: string;
  header?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
      {header && (
        <div className="hidden h-[39px] items-center border-b border-border-default bg-bg-subtle px-5 sheet:flex">
          <Skeleton className="h-[13px] w-[30%]" />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 border-b border-border-subtle px-4 last:border-b-0 sheet:px-5",
            rowHeight,
          )}
        >
          <Skeleton className="size-[36px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-[16px] w-[38%] max-w-[180px]" />
            <Skeleton className="mt-[6px] h-[13px] w-[52%] max-w-[220px]" />
          </div>
          <Skeleton className="h-[16px] w-[22%] max-w-[120px]" />
          <Skeleton className="hidden h-[32px] w-[52px] rounded-control sheet:block" />
        </div>
      ))}
    </div>
  );
}

// One line of text: a box at the text's line height with a thinner bar,
// so the skeleton is exactly as tall as the text it stands for.
export function Line({
  height,
  width,
  className,
}: {
  height: string; // the text's line height, e.g. "h-[19px]"
  width: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", height, className)}>
      <Skeleton className={cn("h-[68%] rounded-md", width)} />
    </div>
  );
}
