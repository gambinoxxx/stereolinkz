// TEMPORARY sample snapshot for the Phase 1 render spike; deleted with the
// route in Phase 6. Like prisma/seed.ts this is sample data, not a list the
// app relies on. The subheading includes ₦ to prove the latin-ext glyph.
import { boardSnapshotV1 } from "@/features/boards/snapshot";

export const spikeSnapshot = boardSnapshotV1.parse({
  v: 1,
  type: "FOREX",
  quoteCurrency: "NGN",
  content: {
    headline: "Today’s\nforex rates",
    subheading: "Naira (₦) per unit, settled fast",
    note: "T+1 settlement to China and the rest of the world",
    reach:
      "Pay into the UK, US, Europe, Canada, China and more by wire, ACH or local bank transfer.",
    ctaLabel: "Send a message to trade",
    finePrint:
      "Rates can change without notice. Rates for large amounts are agreed on request.",
    dateLabel: "Sun, 27 Sept 2026",
    timeLabel: "10:25 AM",
    brand: {
      name: "Stereolinkz",
      logoUrl: null,
      backgroundColor: "#2A0F58",
      primaryColor: "#6A35D9",
      accentColor: "#E9B949",
      contactLine: "+234 800 000 0000",
    },
  },
  rows: [
    {
      currencyId: "fixture-usd",
      code: "USD",
      name: "US dollar",
      flagCode: "us",
      buy: "1365.0000",
      sell: "1378.0000",
    },
    {
      currencyId: "fixture-gbp",
      code: "GBP",
      name: "British pound",
      flagCode: "gb",
      buy: "1815.0000",
      sell: "1840.0000",
    },
    {
      currencyId: "fixture-eur",
      code: "EUR",
      name: "Euro",
      flagCode: "eu",
      buy: "1560.0000",
      sell: "1583.0000",
    },
  ],
});
