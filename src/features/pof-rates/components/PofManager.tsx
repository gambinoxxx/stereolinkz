"use client";

import { Filter, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Callout } from "@/components/callout";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusFilterBar } from "@/components/status-filter-bar";
import { Button } from "@/components/ui/button";
import { setPofActive } from "@/features/pof-rates/actions";
import {
  type PofDrawerState,
  PofRateDrawer,
} from "@/features/pof-rates/components/PofRateDrawer";
import { PofTable } from "@/features/pof-rates/components/PofTable";
import type {
  BankOption,
  PofBankItem,
  PofList,
} from "@/features/pof-rates/queries";
import type { StatusFilter } from "@/lib/status-filter";

type PofManagerProps = PofList & {
  filter: StatusFilter;
  now: string;
  bankOptions: BankOption[]; // ACTIVE banks, for the add drawer
  banksWithoutRate: BankOption[]; // ACTIVE banks with no rate (callout)
};

// Client state for /admin/pof. The list comes from the server (filtered
// by ?status=) and refreshes after each action.
export function PofManager({
  banks,
  timeZone,
  filter,
  now,
  bankOptions,
  banksWithoutRate,
}: PofManagerProps) {
  const [drawer, setDrawer] = useState<PofDrawerState | null>(null);
  // The switch shows at once; when the transition ends React drops the
  // optimistic state, so a failed save reverts to the server's list.
  const [shownBanks, applyOptimistic] = useOptimistic(
    banks,
    (list, change: { id: string; pofActive: boolean }) =>
      list.map((bank) =>
        bank.id === change.id ? { ...bank, pofActive: change.pofActive } : bank,
      ),
  );
  const [, startTransition] = useTransition();

  function togglePof(bank: PofBankItem, active: boolean) {
    startTransition(async () => {
      applyOptimistic({ id: bank.id, pofActive: active });
      const result = await setPofActive(bank.id, active);
      if (result.ok)
        toast.success(
          `${result.data.label} rate ${active ? "activated" : "deactivated"}`,
        );
      else toast.error(result.error);
    });
  }

  function openAdd(bankId?: string) {
    setDrawer({ mode: "add", bankId });
  }
  function openEdit(bank: PofBankItem) {
    setDrawer({ mode: "edit", bank });
  }

  return (
    <>
      <PageHeader
        title="POF rates"
        description="Proof of funds rate per bank, charged per month. Only active rates appear on POF boards."
        actions={
          <>
            <Button variant="outline" onClick={() => openAdd()}>
              <Plus strokeWidth={1.9} />
              Add POF rate
            </Button>
            <Button asChild>
              <Link href="/admin/generator?type=POF">
                <Sparkles strokeWidth={1.9} />
                Generate POF board
              </Link>
            </Button>
          </>
        }
      />

      <StatusFilterBar filter={filter}>
        <Link
          href="/admin/banks"
          className="rounded-lg text-[14px] font-semibold text-accent-primary hover:underline"
        >
          Manage banks
        </Link>
      </StatusFilterBar>

      {banks.length === 0 && filter !== "all" ? (
        // The filter hides every row: say so, rather than "No POF rates yet".
        <EmptyState
          icon={Filter}
          title={
            filter === "active"
              ? "No active POF rates"
              : "No inactive POF rates"
          }
          description={
            filter === "active"
              ? "No bank's rate is showing on new boards. Switch one on under All."
              : "Every bank's rate is showing on new boards."
          }
        />
      ) : (
        <PofTable
          banks={shownBanks}
          timeZone={timeZone}
          now={now}
          onAdd={() => openAdd()}
          onEdit={openEdit}
          onTogglePof={togglePof}
        />
      )}

      {banksWithoutRate.length > 0 && (
        <Callout className="mt-4">
          <ul className="flex flex-col gap-1">
            {banksWithoutRate.map((bank) => (
              <li key={bank.id}>
                {bank.name} has no POF rate yet.{" "}
                <button
                  type="button"
                  onClick={() => openAdd(bank.id)}
                  className="rounded font-semibold underline underline-offset-2"
                >
                  Add one
                </button>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <PofRateDrawer
        state={drawer}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
        bankOptions={bankOptions}
        timeZone={timeZone}
        now={now}
      />
    </>
  );
}
