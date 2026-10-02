"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { GeneratorForm } from "@/features/boards/components/GeneratorForm";
import type { BoardType } from "@/features/boards/defaults";
import type { Prefill } from "@/features/boards/prefill";
import type { GeneratorData } from "@/features/boards/queries";

type GeneratorProps = {
  data: GeneratorData;
  initialType: BoardType;
  initialTemplateKey: string;
  renderedAt: string; // the server's render time, so hydration matches
  prefill: Prefill | null; // ?from=: a saved board's rates and copy
  notice: string | null; // skipped items, or a ?from= that couldn't load
};

const TYPE_LABEL: Record<BoardType, string> = {
  FOREX: "Forex",
  POF: "POF",
  CRYPTO: "Crypto",
};

// generator.html. Owns the board type: switching resets the form (a new
// key remounts it with that type's rows, default template and copy).
export function Generator({
  data,
  initialType,
  initialTemplateKey,
  renderedAt,
  prefill,
  notice,
}: GeneratorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [type, setType] = useState(initialType);
  const [templateKey, setTemplateKey] = useState(initialTemplateKey);
  // Bumped by "Make another" so the form starts again from fresh rates.
  const [round, setRound] = useState(0);
  const [pendingType, setPendingType] = useState<BoardType | null>(null);
  // The ?from= prefill applies to the first form only: switching type or
  // "Make another" starts from current rates, as usual.
  const [usePrefill, setUsePrefill] = useState(prefill !== null);
  const [startingOver, startTransition] = useTransition();

  function syncUrl(nextType: BoardType, nextKey: string) {
    const params = new URLSearchParams({ type: nextType, template: nextKey });
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  function switchType(next: BoardType) {
    const key = data.defaultTemplates[next];
    setPendingType(null);
    setUsePrefill(false);
    setType(next);
    setTemplateKey(key);
    syncUrl(next, key);
  }

  function changeTemplate(key: string) {
    setTemplateKey(key);
    syncUrl(type, key);
  }

  // A fresh form on current rates: refetch, then remount on the new data.
  // Both updates sit in one transition, so the new form appears with it.
  function startOver() {
    setUsePrefill(false);
    startTransition(() => {
      router.refresh();
      setRound((n) => n + 1);
    });
  }

  return (
    <>
      <GeneratorForm
        key={`${type}:${round}`}
        data={data}
        type={type}
        templateKey={templateKey}
        renderedAt={renderedAt}
        prefill={usePrefill ? prefill : null}
        notice={usePrefill || !prefill ? notice : null}
        onTypeRequest={(next, dirty) => {
          if (next === type) return;
          if (dirty) setPendingType(next);
          else switchType(next);
        }}
        onTemplateChange={changeTemplate}
        onStartOver={startOver}
        startingOver={startingOver}
      />
      <Dialog
        open={pendingType !== null}
        onOpenChange={(open) => !open && setPendingType(null)}
      >
        <DialogContent showCloseButton={false}>
          <div className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
            <DialogTitle>
              Switch to {pendingType ? TYPE_LABEL[pendingType] : ""}?
            </DialogTitle>
            <DialogDescription className="mt-2 mb-[22px] text-[15px] text-text-secondary">
              Your edits to this board will be lost.
            </DialogDescription>
            <div className="flex justify-end gap-2.5">
              <DialogClose asChild>
                <Button variant="outline">Keep editing</Button>
              </DialogClose>
              <Button onClick={() => pendingType && switchType(pendingType)}>
                Switch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
