import {
  HeaderSkeleton,
  SkeletonPage,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// The referral ledger: header, four totals, filters, the rewards.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton
        title="w-[150px]"
        lines={2}
        actions={["w-[130px]", "w-[170px]"]}
      />
      <StatCardsSkeleton />
      <div className="mb-3.5 grid gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-[15px] w-[70px]" />
            <Skeleton className="h-[42px] rounded-control" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} rowHeight="h-[76px]" />
    </SkeletonPage>
  );
}
