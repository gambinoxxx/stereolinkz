"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { BankDrawer } from "@/features/banks/components/BankDrawer";
import { BanksTable } from "@/features/banks/components/BanksTable";
import type { BankListItem } from "@/features/banks/queries";

// Client state for /admin/banks: which bank the drawer shows. The list
// itself comes from the server and refreshes after each action.
export function BanksManager({ banks }: { banks: BankListItem[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BankListItem | null>(null);

  function openAdd() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(bank: BankListItem) {
    setEditing(bank);
    setDrawerOpen(true);
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
      <BanksTable banks={banks} onAdd={openAdd} onEdit={openEdit} />
      <BankDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        bank={editing}
      />
    </>
  );
}
