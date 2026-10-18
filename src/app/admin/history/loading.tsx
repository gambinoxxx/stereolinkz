import {
  HeaderSkeleton,
  SkeletonPage,
  TabsSkeleton,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// History: header, the type filter, a day heading and its boards.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton title="w-[120px]" />
      <div className="mb-[22px]">
        <TabsSkeleton width="w-[248px]" />
      </div>
      {[1, 4].map((count, d) => (
        <div key={d} className="mb-6">
          <Skeleton className="mb-3 h-[15px] w-[180px]" />
          <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
            {Array.from({ length: count }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0 sheet:px-5"
              >
                <Skeleton className="h-[110px] w-[62px] shrink-0 rounded-[8px]" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-[17px] w-[45%] max-w-[260px]" />
                  <Skeleton className="mt-3 h-[14px] w-[80%] max-w-[420px]" />
                </div>
                <Skeleton className="hidden h-[32px] w-[280px] rounded-control sheet:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonPage>
  );
}
