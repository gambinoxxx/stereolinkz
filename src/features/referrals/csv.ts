// The ledger as CSV (Phase 13c). Cells are quoted, and a cell that a
// spreadsheet would read as a formula (= + - @) gets a leading apostrophe.
import { SERVICE_LABELS } from "@/features/deals/services";
import { STATUS_LABELS } from "@/features/referrals/labels";
import type { LedgerRow } from "@/features/referrals/queries";

export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function ledgerCsv(rows: LedgerRow[], timeZone: string): string {
  const day = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(iso))
      : "";
  const head = [
    "Date",
    "Deal",
    "Service",
    "Code",
    "Referrer",
    "Our profit (NGN)",
    "Reward %",
    "Reward (NGN)",
    "Status",
    "Note",
    "Approved",
    "Paid",
    "Bank reference",
  ];
  const lines = rows.map((r) =>
    [
      day(r.createdAt),
      r.dealRef,
      SERVICE_LABELS[r.service],
      r.code,
      r.referrer,
      r.profitNaira,
      r.pct,
      r.amountNaira,
      STATUS_LABELS[r.status],
      r.note ?? "",
      day(r.approvedAt),
      day(r.paidAt),
      r.bankReference ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
