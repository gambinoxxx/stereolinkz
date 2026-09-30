// features/boards/snapshot.ts
// The contract between rate data and templates. Templates render ONLY this,
// never Prisma models — which is what makes old boards reproducible.
import { z } from "zod";

import { compareDecimalStrings } from "@/lib/decimal";

// Decimals travel as strings ("1365.0000", "3.40") to avoid float drift
// and because Prisma Decimal can't cross the server/client boundary.
const decimalString = z.string().regex(/^\d+(\.\d+)?$/);

const brand = z.object({
  name: z.string(),
  logoUrl: z.string().url().nullable(),
  backgroundColor: z.string().nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  contactLine: z.string().nullable(),
});

const content = z.object({
  headline: z.string().min(1).max(60),      // "Today’s\nforex rates" (\n = line break)
  subheading: z.string().max(80).nullable(),// "Naira per unit, settled fast"
  note: z.string().max(90).nullable(),      // forex only: "T+1 settlement to China and the rest of the world"
  reach: z.string().max(140).nullable(),    // forex only: coverage line under the card
  ctaLabel: z.string().max(40),             // "Send a message to trade" / "Send a message to apply"
  finePrint: z.string().max(120).nullable(),// small print
  dateLabel: z.string(),                    // pre-formatted in org timezone: "Sun, 27 Sept 2026"
  timeLabel: z.string(),                    // pre-formatted in org timezone: "10:25 AM"
  brand,                                    // copied, so a later logo/colour/number change doesn't alter old boards
});

const forexRow = z.object({
  currencyId: z.string(),         // traceability only; never re-queried for rendering
  code: z.string(),
  name: z.string(),
  flagCode: z.string().nullable(),
  buy: decimalString,
  sell: decimalString,
}).refine((row) => compareDecimalStrings(row.sell, row.buy) >= 0, {
  // Same rule as the DB CHECK forex_sell_gte_buy (added in Phase 6).
  message: "Sell must be the same as or higher than buy.",
  path: ["sell"],
});

const pofRow = z.object({
  bankId: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  rate: decimalString,
  note: z.string().nullable(),
});

const customRow = z.object({ label: z.string(), value: z.string(), note: z.string().nullable() });

export const boardSnapshotV1 = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("FOREX"), quoteCurrency: z.string(), content, rows: z.array(forexRow).min(1) }),
  z.object({ v: z.literal(1), type: z.literal("POF"), content, rows: z.array(pofRow).min(1) }),
  z.object({ v: z.literal(1), type: z.literal("CUSTOM"), content, rows: z.array(customRow).min(1) }),
]);

export type BoardSnapshot = z.infer<typeof boardSnapshotV1>;
