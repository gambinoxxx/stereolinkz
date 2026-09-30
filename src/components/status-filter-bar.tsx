"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { StatusFilter } from "@/lib/status-filter";

// forex.html / pof.html .toolbar: the segmented All / Active / Inactive
// filter bound to ?status= (no reload), with a hint or link on the right.
export function StatusFilterBar({
  filter,
  children,
}: {
  filter: StatusFilter;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <ToggleGroup
        type="single"
        variant="segmented"
        size="segmented"
        value={filter}
        onValueChange={(next) => {
          if (!next) return;
          router.replace(
            next === "all" ? pathname : `${pathname}?status=${next}`,
            { scroll: false },
          );
        }}
        aria-label="Filter by status"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="active">Active</ToggleGroupItem>
        <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
      </ToggleGroup>
      {children}
    </div>
  );
}
