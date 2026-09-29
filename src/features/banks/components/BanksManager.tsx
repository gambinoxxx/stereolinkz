"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { setBankStatus } from "@/features/banks/actions";
import { BankDrawer } from "@/features/banks/components/BankDrawer";
import { BanksTable } from "@/features/banks/components/BanksTable";
import { DeleteBankDialog } from "@/features/banks/components/DeleteBankDialog";
import type { BankListItem } from "@/features/banks/queries";

// Client state for /admin/banks: which bank the drawer or the delete
// dialog shows, and which row is changing status. The list itself comes
// from the server and refreshes after each action.
export function BanksManager({ banks }: { banks: BankListItem[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BankListItem | null>(null);
  const [deleting, setDeleting] = useState<BankListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openAdd() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(bank: BankListItem) {
    setEditing(bank);
    setDrawerOpen(true);
  }

  function toggleStatus(bank: BankListItem) {
    if (busyId) return;
    const next = bank.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusyId(bank.id);
    startTransition(async () => {
      const result = await setBankStatus(bank.id, next);
      setBusyId(null);
      if (result.ok) {
        toast.success(
          `${result.data.name} ${next === "ACTIVE" ? "activated" : "deactivated"}`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Banks"
        description="Banks are records, not code. Add one here and it’s ready for POF rates and boards straight away."
        actions={
          <Button onClick={openAdd}>
            <Plus strokeWidth={1.9} />
            Add bank
          </Button>
        }
      />
      <BanksTable
        banks={banks}
        onAdd={openAdd}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onDelete={setDeleting}
        busyId={busyId}
      />
      <BankDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        bank={editing}
      />
      <DeleteBankDialog
        bank={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </>
  );
}
