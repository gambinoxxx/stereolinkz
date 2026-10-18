import {
  HeaderSkeleton,
  SkeletonPage,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/shell/skeletons";

// Rates page: header, the All / Active / Inactive control, the table.
export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton
        title="w-[170px]"
        lines={2}
        actions={["w-[120px]", "w-[206px]"]}
      />
      <div className="mb-3.5 flex items-center justify-between">
        <TabsSkeleton />
      </div>
      <TableSkeleton rows={6} />
    </SkeletonPage>
  );
}
