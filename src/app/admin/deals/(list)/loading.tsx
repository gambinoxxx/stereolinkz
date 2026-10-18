import {
  HeaderSkeleton,
  SkeletonPage,
  StatCardsSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Deals queue (deals.html), in a route group so it never stands in for
// one deal or Wallets: header, four stat cards, filters, the list.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton
        title="w-[110px]"
        lines={2}
        actions={["w-[106px]", "w-[118px]"]}
      />
      <StatCardsSkeleton />
      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <TabsSkeleton width="w-full sheet:w-[368px]" />
        <Skeleton className="h-[42px] w-full rounded-control sheet:w-[300px]" />
        <Skeleton className="h-[42px] w-[48%] rounded-control sheet:w-[195px]" />
        <Skeleton className="h-[42px] w-[48%] rounded-control sheet:w-[160px]" />
      </div>
      <TableSkeleton rows={6} rowHeight="h-[76px]" />
    </SkeletonPage>
  );
}
