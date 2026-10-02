"use client";

import { Filter, Info, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusFilterBar } from "@/components/status-filter-bar";
import { Button } from "@/components/ui/button";
import type { CoinList, CoinListItem } from "@/features/coins/queries";
import { reorderCoins, setCoinStatus } from "@/features/crypto-rates/actions";
import { CoinDrawer } from "@/features/crypto-rates/components/CoinDrawer";
import { CryptoRateDrawer } from "@/features/crypto-rates/components/CryptoRateDrawer";
import { CryptoTable } from "@/features/crypto-rates/components/CryptoTable";
import type { StatusFilter } from "@/lib/status-filter";

type CryptoManagerProps = CoinList & {
  filter: StatusFilter;
  now: string;
};

type OptimisticChange =
  | { type: "status"; id: string; status: "ACTIVE" | "INACTIVE" }
  | { type: "order"; ids: string[] };

function applyChange(
  list: CoinListItem[],
  change: OptimisticChange,
): CoinListItem[] {
  if (change.type === "status")
    return list.map((c) =>
      c.id === change.id ? { ...c, status: change.status } : c,
    );
  const byId = new Map(list.map((c) => [c.id, c]));
  return change.ids.flatMap((id) => byId.get(id) ?? []);
}

// Client state for /admin/crypto (the Phase 4 forex pattern). The list comes from the server (filtered
// by ?status=) and refreshes after each action. Status (and order) changes
// show at once through useOptimistic; when the transition ends React drops
// the optimistic state, so a failed save reverts to the server's list.
export function CryptoManager({
  coins,
  timeZone,
  filter,
  now,
}: CryptoManagerProps) {
  const [editing, setEditing] = useState<CoinListItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [shown, applyOptimistic] = useOptimistic(coins, applyChange);
  const [, startTransition] = useTransition();

  function toggleStatus(coin: CoinListItem, active: boolean) {
    const status = active ? "ACTIVE" : "INACTIVE";
    startTransition(async () => {
      applyOptimistic({ type: "status", id: coin.id, status });
      const result = await setCoinStatus(coin.id, status);
      if (result.ok)
        toast.success(
          `${result.data.ticker} ${active ? "activated" : "deactivated"}`,
        );
      else toast.error(result.error);
    });
  }

  function openAdd() {
    setAdding(true);
  }

  function reorder(ids: string[]) {
    startTransition(async () => {
      applyOptimistic({ type: "order", ids });
      const result = await reorderCoins(ids);
      if (result.ok) toast.success("Order saved. New boards use it.");
      else toast.error(result.error);
    });
  }

  return (
    <>
      <PageHeader
        title="Crypto rates"
        description="Naira per $1 of coin. For stablecoins like USDT that is per coin. Saving a new rate keeps the old one in history."
        actions={
          <>
            <Button variant="outline" onClick={openAdd}>
              <Plus strokeWidth={1.9} />
              Add coin
            </Button>
            <Button asChild>
              <Link href="/admin/generator?type=CRYPTO">
                <Sparkles strokeWidth={1.9} />
                Generate crypto board
              </Link>
            </Button>
          </>
        }
      />

      <StatusFilterBar filter={filter}>
        {filter === "all" ? (
          <span className="hidden text-[13.5px] text-text-muted sheet:inline">
            Drag rows to set their order on boards
          </span>
        ) : (
          <span className="text-[13.5px] text-text-muted">
            Switch to All to change the order
          </span>
        )}
      </StatusFilterBar>

      {shown.length === 0 && filter !== "all" ? (
        // The filter hides every row: say so, rather than "Add your first coin".
        <EmptyState
          icon={Filter}
          title={filter === "active" ? "No active coins" : "No inactive coins"}
          description={
            filter === "active"
              ? "No coin is showing on new boards. Switch one on under All."
              : "Every coin is showing on new boards."
          }
        />
      ) : (
        <CryptoTable
          coins={shown}
          timeZone={timeZone}
          now={now}
          onAdd={openAdd}
          onToggleStatus={toggleStatus}
          reorderable={filter === "all"}
          onReorder={reorder}
          onEdit={setEditing}
        />
      )}

      {shown.length > 0 && (
        <p className="mt-3.5 flex gap-2 text-[13.5px] text-text-muted">
          <Info
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.9}
          />
          Rates are naira per $1 of coin value. A customer selling $500 of a
          coin at ₦1,580 receives ₦790,000. Only active coins appear on new
          boards; a crypto board fits 6 coins.
        </p>
      )}

      <CryptoRateDrawer
        coin={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        timeZone={timeZone}
        now={now}
      />
      <CoinDrawer open={adding} onOpenChange={setAdding} />
    </>
  );
}
