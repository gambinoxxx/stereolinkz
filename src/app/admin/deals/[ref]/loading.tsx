import {
  PanelSkeleton,
  LinesSkeleton,
  SkeletonPage,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// One deal (deal-detail*.html): back link, title, the progress steps, then
// the main panels and the deal / customer / activity column.
export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="mb-[14px] h-[17px] w-[80px]" />
      <div className="mb-1.5 flex items-center gap-3">
        <Skeleton className="size-9 rounded-[10px]" />
        <Skeleton className="h-[28px] w-[260px] shell:h-[30px] shell:w-[300px]" />
      </div>
      <Skeleton className="mb-[22px] h-[17px] w-[min(420px,90%)]" />
      <Skeleton className="mb-[22px] h-[56px] rounded-panel" />
      <div className="grid items-start gap-[22px] wide:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid gap-[22px]">
          <PanelSkeleton title="w-[130px]">
            <LinesSkeleton rows={6} />
          </PanelSkeleton>
          <PanelSkeleton title="w-[150px]">
            <LinesSkeleton rows={3} />
          </PanelSkeleton>
        </div>
        <div className="grid gap-[22px]">
          <PanelSkeleton title="w-[60px]">
            <LinesSkeleton rows={6} />
          </PanelSkeleton>
          <PanelSkeleton title="w-[100px]">
            <LinesSkeleton rows={4} />
          </PanelSkeleton>
        </div>
      </div>
    </SkeletonPage>
  );
}
