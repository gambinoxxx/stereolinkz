// Default board copy per type, from docs/design/stereolinkz-rate-boards.html.
// The generator (Phase 7) lets the admin change these per board.

// The board types the generator makes. CUSTOM stays reserved in the schema.
export type BoardType = "FOREX" | "POF" | "CRYPTO";

export const BOARD_TYPES: readonly BoardType[] = ["FOREX", "POF", "CRYPTO"];

export type ContentDefaults = {
  headline: string; // "\n" is the line break
  subheading: string | null;
  note: string | null;
  reach: string | null;
  ctaLabel: string;
  finePrint: string; // used when the org has no defaultFinePrint
};

export const CONTENT_DEFAULTS: Record<BoardType, ContentDefaults> = {
  FOREX: {
    headline: "Today’s\nforex rates",
    subheading: "Naira per unit, settled fast",
    note: "T+1 settlement to China and the rest of the world",
    reach:
      "Pay into the UK, US, Europe, Canada, China and more by wire, ACH or local bank transfer.",
    ctaLabel: "Send a message to trade",
    finePrint:
      "Rates can change without notice. Rates for large amounts are agreed on request.",
  },
  POF: {
    headline: "Proof of\nfunds rates",
    subheading: "For visa, school and travel applications",
    note: null,
    reach: null,
    ctaLabel: "Send a message to apply",
    finePrint: "Rates can change without notice. Terms and conditions apply.",
  },
  // stereolinkz-crypto-board.html. The note is sample copy; the owner
  // edits it per board. No reach paragraph on crypto boards.
  CRYPTO: {
    headline: "Today’s\ncrypto rates",
    subheading: "Naira per $1 of coin, paid in minutes",
    note: "Also trading TRX, LTC and TON. Ask for a rate.",
    reach: null,
    ctaLabel: "Send a message to trade",
    finePrint:
      "Rates can change without notice. Always confirm the network before you send.",
  },
};
