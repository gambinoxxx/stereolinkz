"use client";

import "./board-fonts.css";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { TYPE_LABEL } from "@/features/boards/history";
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { BOARD_H, BOARD_W } from "@/features/templates/layout";
import { getTemplate } from "@/features/templates/registry";
import { cn } from "@/lib/utils";

type BoardFrameProps = {
  templateKey: string;
  snapshot: BoardSnapshot;
  overlay?: ReactNode; // drawn in board pixels on top (WhatsAppOverlay)
  label?: string; // accessible name; defaults to "Forex board preview"
  className?: string;
};

// The same template component the server renders to PNG, drawn at its real
// 1080 × 1920 and scaled to the container's width (ui-context.md →
// components/board/BoardFrame). Fonts come from board-fonts.css: the same
// WOFF files and family names Satori uses.
export function BoardFrame({
  templateKey,
  snapshot,
  overlay,
  label,
  className,
}: BoardFrameProps) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / BOARD_W);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const template = getTemplate(templateKey);
  const board = (template.render as (s: BoardSnapshot) => ReactNode)(snapshot);

  return (
    <div
      ref={box}
      role="img"
      aria-label={label ?? `${TYPE_LABEL[snapshot.type]} preview`}
      className={cn(
        "relative aspect-[9/16] w-full overflow-hidden rounded-control",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 origin-top-left select-none"
        style={{
          width: BOARD_W,
          height: BOARD_H,
          transform: `scale(${scale ?? 0})`,
          // Hidden until measured, so it never flashes at full size.
          visibility: scale === null ? "hidden" : "visible",
        }}
      >
        {board}
        {overlay}
      </div>
    </div>
  );
}
