import { describe, expect, it } from "vitest";

import { csvCell, ledgerCsv } from "@/features/referrals/csv";

describe("ledger CSV", () => {
  it("quotes cells and defuses formulas", () => {
    expect(csvCell("SLZ-1047")).toBe('"SLZ-1047"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-5")).toBe(`"'-5"`);
  });
  it("has the ledger's columns and no customer fields", () => {
    const csv = ledgerCsv(
      [
        {
          id: "r1",
          dealRef: "SLZ-1047",
          service: "POF",
          code: "LYDIA",
          referrerKey: "m:1",
          referrer: "Lydia",
          pct: "15",
          profitNaira: "100000",
          amountNaira: "15000",
          status: "PAID",
          note: null,
          flagged: false,
          createdAt: "2026-10-18T10:00:00.000Z",
          approvedAt: "2026-10-26T10:00:00.000Z",
          paidAt: "2026-10-27T10:00:00.000Z",
          bankReference: "GTB123",
        },
      ],
      "Africa/Lagos",
    );
    const [head, row] = csv.trim().split("\r\n");
    expect(head).not.toMatch(/customer|whatsapp|email|phone/i);
    expect(row).toContain('"SLZ-1047"');
    expect(row).toContain('"15000"');
    expect(row).toContain('"GTB123"');
  });
});
