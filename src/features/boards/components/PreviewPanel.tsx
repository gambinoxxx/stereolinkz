"use client";

import { useId, useState } from "react";

import { BoardFrame } from "@/components/board/BoardFrame";
import { WhatsAppOverlay } from "@/components/board/WhatsAppOverlay";
import { Switch } from "@/components/ui/switch";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { cn } from "@/lib/utils";

type PreviewPanelProps = {
  templateKey: string;
  snapshot: BoardSnapshot;
  className?: string;
};

// generator.html .gen-prev: the board as it will render, with an optional
// WhatsApp Status overlay (preview only, never in the PNG).
export function PreviewPanel({
  templateKey,
  snapshot,
  className,
}: PreviewPanelProps) {
  const id = useId();
  const [overlay, setOverlay] = useState(false);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "rounded-panel border border-border-default bg-bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <h2 id={`${id}-title`} className="text-base font-bold">
          Preview
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-text-secondary">
          <Switch checked={overlay} onCheckedChange={setOverlay} />
          WhatsApp view
        </label>
      </div>
      <div className="flex flex-col items-center gap-2.5 rounded-b-panel bg-board-stage p-4 shell:p-[22px]">
        <BoardFrame
          templateKey={templateKey}
          snapshot={snapshot}
          label="Board preview"
          overlay={
            overlay ? (
              <WhatsAppOverlay name={snapshot.content.brand.name} />
            ) : undefined
          }
          className="w-full max-w-[220px] shadow-[0_18px_40px_rgb(31_11_63/0.25)] shell:max-w-[340px]"
        />
        <span className="text-[12.5px] text-text-muted">1080 × 1920 PNG</span>
      </div>
    </section>
  );
}
