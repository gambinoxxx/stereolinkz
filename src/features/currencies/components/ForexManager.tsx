"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ForexTable } from "@/features/currencies/components/ForexTable";
import type {
  CurrencyList,
  CurrencyListItem,
} from "@/features/currencies/queries";
import type { StatusFilter } from "@/features/currencies/status-filter";

type ForexManagerProps = CurrencyList & {
  filter: StatusFilter;
  now: string;
};

// Client state for /admin/forex. The list comes from the server (filtered
// by ?status=) and refreshes after each action.
export function ForexManager({
  currencies,
  timeZone,
  filter,
  now,
}: ForexManagerProps) {
  const router = useRouter();

  function setFilter(next: StatusFilter) {
    router.replace(
      next === "all" ? "/admin/forex" : `/admin/forex?status=${next}`,
      { scroll: false },
    );
  }

  // Wired in the Edit rate and Add currency parts.
  function openAdd() {}
  function openEdit(currency: CurrencyListItem) {
    void currency;
  }

  return (
    <>
      <PageHeader
        title="Forex rates"
        description="Naira per unit. Saving a new rate keeps the old one in history, so earlier boards stay accurate."
        actions={
          <>
            <Button variant="outline" onClick={openAdd}>
              <Plus strokeWidth={1.9} />
              Add currency
            </Button>
            <Button asChild>
              <Link href="/admin/generator?type=FOREX">
                <Sparkles strokeWidth={1.9} />
                Generate forex board
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="segmented"
          value={filter}
          onValueChange={(next) => next && setFilter(next as StatusFilter)}
          aria-label="Filter by status"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
        </ToggleGroup>
        <span className="hidden text-[13.5px] text-text-muted sheet:inline">
          {filter === "all"
            ? "Drag rows to set their order on boards"
            : "Switch to All to change the order"}
        </span>
      </div>

      <ForexTable
        currencies={currencies}
        timeZone={timeZone}
        now={now}
        onAdd={openAdd}
        onEdit={openEdit}
      />
    </>
  );
}
