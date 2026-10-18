import {
  HeaderSkeleton,
  Line,
  SkeletonPage,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard (dashboard.html), in a route group so this skeleton covers
// only the dashboard, not every admin page; in DashboardView's own sizes: header, the
// deals notice, the stat strip, today's forex and POF, recent boards and
// rate changes.
function DashPanel({
  title,
  rows,
  children,
}: {
  title: string;
  rows?: number;
  children?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-panel border border-border-default bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-[15px]">
        <Line height="h-6" width={title} />
        <Line height="h-6" width="w-[90px]" />
      </div>
      {children ??
        Array.from({ length: rows ?? 3 }, (_, i) => (
          <div
            key={i}
            className="flex h-[71px] items-center gap-3 border-b border-border-subtle px-5 last:border-b-0"
          >
            <Skeleton className="size-[34px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Line height="h-[19px]" width="w-[30%] max-w-[110px]" />
              <Line height="h-[19px]" width="w-[45%] max-w-[140px]" />
            </div>
            <div className="flex flex-col items-end">
              <Line height="h-[24px]" width="w-[96px]" />
              <Line height="h-[20px]" width="w-[48px]" />
            </div>
          </div>
        ))}
    </section>
  );
}

export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton title="w-[230px]" actions={["w-[142px]", "w-[162px]"]} />
      <Skeleton className="mb-5 h-[44px] rounded-control" />
      <div className="mb-6 grid grid-cols-2 rounded-panel border border-border-default bg-bg-surface shell:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="border-border-subtle px-4 py-3.5 not-first:border-l nth-3:border-l-0 nth-[n+3]:border-t shell:px-[22px] shell:py-[18px] shell:nth-3:border-l shell:nth-[n+3]:border-t-0"
          >
            <Line height="h-[19.5px]" width="w-[60%]" />
            <Line height="mt-0.5 h-[27.6px] shell:h-[32.4px]" width="w-[40%]" />
            <Line height="mt-0.5 h-[19.5px]" width="w-[30%]" />
          </div>
        ))}
      </div>
      <div className="mb-6 grid gap-6 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <DashPanel title="w-[120px]" rows={3} />
        <DashPanel title="w-[110px]" rows={6} />
      </div>
      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <DashPanel title="w-[130px]">
          <div className="grid grid-cols-3 gap-2.5 p-3.5 sheet:gap-4 sheet:px-5 sheet:py-[18px]">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-[9/16] rounded-control" />
                <Line height="h-[18px]" width="w-[70%]" />
              </div>
            ))}
          </div>
        </DashPanel>
        <DashPanel title="w-[170px]" rows={5} />
      </div>
    </SkeletonPage>
  );
}
