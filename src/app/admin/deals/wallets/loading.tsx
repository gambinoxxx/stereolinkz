import {
  HeaderSkeleton,
  PanelSkeleton,
  SkeletonPage,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Wallets: one balance card per watched address, then the ETH checker.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton title="w-[130px]" lines={2} />
      <div className="grid gap-4 sheet:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <PanelSkeleton key={i} title="w-[140px]">
            <Skeleton className="h-[34px] w-[70%]" />
            <Skeleton className="mt-3 h-[14px] w-[40%]" />
          </PanelSkeleton>
        ))}
      </div>
    </SkeletonPage>
  );
}
