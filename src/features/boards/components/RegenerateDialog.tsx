"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { regenerateBoard } from "@/features/boards/actions";
import type { BoardListItem } from "@/features/boards/history";
import { listTemplates } from "@/features/templates/registry";

type RegenerateDialogProps = {
  board: BoardListItem | null; // open while set; only readable boards
  onClose: () => void;
};

// history-regenerate.html. The board is drawn again from its snapshot with
// a template of its type; the rates and the original image stay as they
// were. The new image becomes the one Download serves.
export function RegenerateDialog({ board, onClose }: RegenerateDialogProps) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  // Keep showing the last board while the dialog animates closed, and
  // start each board on its own template.
  const [shown, setShown] = useState(board);
  const [templateKey, setTemplateKey] = useState(board?.templateKey ?? "");
  if (board && board !== shown) {
    setShown(board);
    setTemplateKey(board.templateKey);
  }

  const templates =
    shown && shown.type !== "CUSTOM" ? listTemplates(shown.type) : [];

  function regenerate() {
    if (!shown || submitting.current) return;
    submitting.current = true;
    const target = shown;
    startTransition(async () => {
      try {
        const result = await regenerateBoard({
          boardId: target.id,
          templateKey,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onClose();
        toast.success("New image ready", {
          action: {
            label: "Download",
            // A file download, not a navigation: the route answers with
            // Content-Disposition: attachment.
            onClick: () => {
              const link = document.createElement("a");
              link.href = `/api/boards/${target.id}/download`;
              link.download = "";
              link.click();
            },
          },
        });
        router.refresh(); // the detail's image count
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <Dialog
      open={board !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        {shown?.snapshot && (
          <div className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
            <DialogTitle className="text-[19px] font-[750]">
              Regenerate image
            </DialogTitle>
            <DialogDescription className="mt-2 mb-[18px] text-[15px] text-text-secondary">
              Renders this board again from its saved snapshot. The rates stay
              as they were at {shown.snapshot.content.timeLabel}, and the
              original image is kept.
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-template`}>Template</Label>
              <Select
                value={templateKey}
                onValueChange={setTemplateKey}
                disabled={pending}
              >
                <SelectTrigger id={`${id}-template`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.key === shown.templateKey
                        ? `${t.name} (original)`
                        : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-[22px] flex justify-end gap-2.5">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={regenerate}
                disabled={!templates.some((t) => t.key === templateKey)}
                aria-disabled={pending || undefined}
              >
                {pending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" strokeWidth={1.9} />
                )}
                {pending ? "Generating image…" : "Regenerate image"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
