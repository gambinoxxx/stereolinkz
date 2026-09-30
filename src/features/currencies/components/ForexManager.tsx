"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  reorderCurrencies,
  setCurrencyStatus,
} from "@/features/currencies/actions";
import { CurrencyDrawer } from "@/features/currencies/components/CurrencyDrawer";
import { ForexTable } from "@/features/currencies/components/ForexTable";
import type {
  CurrencyList,
  CurrencyListItem,
} from "@/features/currencies/queries";
import type { StatusFilter } from "@/features/currencies/status-filter";
import { ForexRateDrawer } from "@/features/forex-rates/components/ForexRateDrawer";

type ForexManagerProps = CurrencyList & {
  filter: StatusFilter;
  now: string;
};

type OptimisticChange =
  | { type: "status"; id: string; status: "ACTIVE" | "INACTIVE" }
  | { type: "order"; ids: string[] };

function applyChange(
  list: CurrencyListItem[],
  change: OptimisticChange,
): CurrencyListItem[] {
  if (change.type === "status")
    return list.map((c) =>
      c.id === change.id ? { ...c, status: change.status } : c,
    );
  const byId = new Map(list.map((c) => [c.id, c]));
  return change.ids.flatMap((id) => byId.get(id) ?? []);
}

// Client state for /admin/forex. The list comes from the server (filtered
// by ?status=) and refreshes after each action. Status (and order) changes
// show at once through useOptimistic; when the transition ends React drops
// the optimistic state, so a failed save reverts to the server's list.
export function ForexManager({
  currencies,
  timeZone,
  filter,
  now,
}: ForexManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<CurrencyListItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [shown, applyOptimistic] = useOptimistic(currencies, applyChange);
  const [, startTransition] = useTransition();

  function toggleStatus(currency: CurrencyListItem, active: boolean) {
    const status = active ? "ACTIVE" : "INACTIVE";
    startTransition(async () => {
      applyOptimistic({ type: "status", id: currency.id, status });
      const result = await setCurrencyStatus(currency.id, status);
      if (result.ok)
        toast.success(
          `${result.data.code} ${active ? "activated" : "deactivated"}`,
        );
      else toast.error(result.error);
    });
  }

  function setFilter(next: StatusFilter) {
    router.replace(
      next === "all" ? "/admin/forex" : `/admin/forex?status=${next}`,
      { scroll: false },
    );
  }

  function openAdd() {
    setAdding(true);
  }

  function reorder(ids: string[]) {
    startTransition(async () => {
      applyOptimistic({ type: "order", ids });
      const result = await reorderCurrencies(ids);
      if (result.ok) toast.success("Order saved. New boards use it.");
      else toast.error(result.error);
    });
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
        {filter === "all" ? (
          <span className="hidden text-[13.5px] text-text-muted sheet:inline">
            Drag rows to set their order on boards
          </span>
        ) : (
          <span className="text-[13.5px] text-text-muted">
            Switch to All to change the order
          </span>
        )}
      </div>

      <ForexTable
        currencies={shown}
        timeZone={timeZone}
        now={now}
        onAdd={openAdd}
        onToggleStatus={toggleStatus}
        reorderable={filter === "all"}
        onReorder={reorder}
        onEdit={setEditing}
      />

      <ForexRateDrawer
        currency={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        timeZone={timeZone}
        now={now}
      />
      <CurrencyDrawer open={adding} onOpenChange={setAdding} />
    </>
  );
}
