import type { MouseEvent, ReactNode } from "react";

// Grid-row tables (banks, forex, POF). Each value cell carries its own
// label: shown above the value on phone cards, screen-reader-only from
// 760px, where the header row (visual only) takes over.
export function CellLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-px block text-[11.5px] font-semibold text-text-muted sheet:sr-only">
      {children}
    </span>
  );
}

// True when a click on a row card landed on one of its controls, so
// tapping the card itself can open the drawer without hijacking them.
export function isRowControl(event: MouseEvent): boolean {
  return Boolean(
    (event.target as HTMLElement).closest(
      "button, a, input, label, [role=switch]",
    ),
  );
}
