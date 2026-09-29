"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteBank } from "@/features/banks/actions";
import type { BankListItem } from "@/features/banks/queries";

type DeleteBankDialogProps = {
  bank: BankListItem | null; // open while set
  onOpenChange: (open: boolean) => void;
};

// bank-delete.html: only offered for banks with no rate history; the
// server checks again.
export function DeleteBankDialog({
  bank,
  onOpenChange,
}: DeleteBankDialogProps) {
  const [pending, startTransition] = useTransition();
  // Keep showing the last bank while the dialog animates closed.
  const [shown, setShown] = useState(bank);
  if (bank && bank !== shown) setShown(bank);

  function confirm() {
    if (!bank || pending) return;
    startTransition(async () => {
      const result = await deleteBank(bank.id);
      if (result.ok) {
        onOpenChange(false);
        toast.success(`${result.data.name} deleted`);
      } else {
        onOpenChange(false);
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={bank !== null}
      onOpenChange={(open) => {
        if (!pending) onOpenChange(open);
      }}
    >
      <DialogContent showCloseButton={false}>
        <div className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <DialogTitle>Delete {shown?.name}?</DialogTitle>
          <DialogDescription className="mt-2 mb-[22px] text-[15px] text-text-secondary">
            It has no rate history, so no board depends on it. This can’t be
            undone.
          </DialogDescription>
          <div className="flex justify-end gap-2.5">
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending && (
                <Loader2 aria-hidden="true" className="animate-spin" />
              )}
              {pending ? "Deleting…" : "Delete bank"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
