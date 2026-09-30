import type { ReactNode } from "react";

export type RecentChange = { id: string; when: string; value: ReactNode };

// The drawers' "Recent changes" (forex-edit.html, pof-edit.html .hist):
// newest first, with the insert-only note under it.
export function RecentChanges({
  heading,
  rows,
}: {
  heading: string; // "Buy / Sell", "Rate"
  rows: RecentChange[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-semibold">Recent changes</span>
      <div className="overflow-hidden rounded-[12px] border border-border-default">
        <div className="flex justify-between border-b border-border-subtle bg-bg-subtle px-3.5 py-2.5 text-[12.5px] font-semibold text-text-muted">
          <span>When</span>
          <span>{heading}</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-3.5 py-2.5 text-[14px] text-text-muted">
            No rates yet.
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5 text-[14px] last:border-b-0"
              >
                <span className="text-text-secondary">{row.when}</span>
                <span className="text-right tabular-nums">{row.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="text-[13px] text-text-muted">
        Saving adds a new entry. Nothing is overwritten.
      </span>
    </div>
  );
}
