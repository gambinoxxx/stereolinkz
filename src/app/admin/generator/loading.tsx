import {
  HeaderSkeleton,
  PanelSkeleton,
  SkeletonPage,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Header and a panel while the page loads.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton title="w-[160px]" />
      <PanelSkeleton title="w-[160px]">
        <div className="grid grid-cols-2 gap-4 sheet:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-[10px]" />
          ))}
        </div>
      </PanelSkeleton>
    </SkeletonPage>
  );
}
