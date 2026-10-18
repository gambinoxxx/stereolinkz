import {
  HeaderSkeleton,
  Line,
  SkeletonPage,
} from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Settings (General and Deal desk), in settings-parts' own sizes: header,
// the tabs, then sections of a label column and a card of fields.
function Field() {
  return (
    <div className="flex flex-col gap-1.5">
      <Line height="h-[20px]" width="w-[110px]" />
      <Skeleton className="h-[42px] rounded-control" />
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid gap-3.5 border-t border-border-default py-[26px] first-of-type:border-t-0 first-of-type:pt-0 shell:grid-cols-[260px_minmax(0,1fr)] shell:gap-8">
      <div>
        <Line height="h-[25px]" width="w-[120px]" />
        <Line height="mt-1 h-[20px]" width="w-[210px]" />
      </div>
      <div className="flex flex-col gap-4 rounded-panel border border-border-default bg-bg-surface p-[22px]">
        {children}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <SkeletonPage>
      <HeaderSkeleton title="w-[140px]" actions={["w-[124px]"]} />
      <div className="-mt-1.5 mb-[22px] flex gap-1 border-b border-border-default">
        {["w-[58px]", "w-[66px]"].map((w) => (
          <div key={w} className="px-3.5 py-2.5">
            <Line height="h-[22px]" width={w} />
          </div>
        ))}
      </div>
      <Section>
        <div className="grid gap-3.5 sheet:grid-cols-2">
          <Field />
          <Field />
        </div>
        <Field />
        <div className="flex flex-col gap-1.5">
          <Line height="h-[20px]" width="w-[50px]" />
          <Skeleton className="h-[72px] rounded-control" />
        </div>
      </Section>
      <Section>
        <div className="grid gap-3 sheet:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[56px] rounded-control" />
          ))}
        </div>
      </Section>
    </SkeletonPage>
  );
}
