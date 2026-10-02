// Sample boards for tests, scripts/render-fixtures.ts and the dev kit's
// preview-vs-PNG comparison. The only place in src/ (outside the seed)
// where sample bank, currency and coin names appear; never used by the app.
import {
  buildSnapshot,
  type CryptoRow,
  type CryptoSnapshot,
  type ForexRow,
  type ForexSnapshot,
  type PofRow,
  type PofSnapshot,
  type SnapshotOrg,
} from "@/features/boards/build-snapshot";

export const FIXTURE_NOW = new Date("2026-09-27T09:25:00Z"); // Sun 27 Sept, 10:25 AM in Lagos

export const FIXTURE_ORG: SnapshotOrg = {
  name: "Stereolinkz",
  timezone: "Africa/Lagos",
  quoteCurrency: "NGN",
  logoUrl: null,
  backgroundColor: "#2A0F58",
  primaryColor: "#6A35D9",
  accentColor: "#E9B949",
  contactLine: "+234 800 000 0000",
  defaultFinePrint: null,
};

const fx = (
  code: string,
  name: string,
  flagCode: string | null,
  buy: string,
  sell: string,
): ForexRow => ({
  currencyId: `fixture-${code.toLowerCase()}`,
  code,
  name,
  flagCode,
  buy,
  sell,
});

const pof = (
  name: string,
  shortName: string,
  rate: string,
  note: string | null,
  logoUrl: string | null = null,
): PofRow => ({
  bankId: `fixture-${shortName.toLowerCase().replace(/\W/g, "")}`,
  name,
  shortName,
  logoUrl,
  rate,
  note,
});

const coin = (
  ticker: string,
  name: string,
  networks: string[],
  badgeColor: string | null,
  buy: string,
  sell: string,
  iconUrl: string | null = null,
): CryptoRow => ({
  coinId: `fixture-${ticker.toLowerCase()}`,
  ticker,
  name,
  networks,
  iconUrl,
  badgeColor,
  buy,
  sell,
});

export const SEED_FOREX_ROWS: ForexRow[] = [
  fx("USD", "US dollar", "us", "1365.0000", "1378.0000"),
  fx("GBP", "British pound", "gb", "1815.0000", "1840.0000"),
  fx("EUR", "Euro", "eu", "1560.0000", "1583.0000"),
];

export const SEED_POF_ROWS: PofRow[] = [
  pof("Wema Bank", "Wema", "3.40", null),
  pof("Providus Bank", "Providus", "3.40", "New account"),
  pof("Ecobank", "Ecobank", "3.40", "New account"),
  pof("Fidelity Bank", "Fidelity", "3.40", "New account"),
  pof("Parallex Bank", "Parallex", "2.10", null),
  pof("Globus Bank", "Globus", "2.30", null),
];

// stereolinkz-crypto-board.html: naira per $1 of coin value.
export const SEED_CRYPTO_ROWS: CryptoRow[] = [
  coin(
    "USDT",
    "Tether",
    ["TRC20", "BEP20"],
    "#1A9E77",
    "1590.0000",
    "1615.0000",
  ),
  coin(
    "USDC",
    "USD Coin",
    ["ERC20", "BEP20"],
    "#2775CA",
    "1585.0000",
    "1612.0000",
  ),
  coin("BTC", "Bitcoin", ["Bitcoin"], "#F7931A", "1580.0000", "1620.0000"),
  coin("ETH", "Ethereum", ["ERC20"], "#627EEA", "1575.0000", "1615.0000"),
  coin("SOL", "Solana", ["Solana"], "#0F9D9A", "1560.0000", "1605.0000"),
  coin("BNB", "BNB", ["BEP20"], "#E0A100", "1560.0000", "1605.0000"),
];

export const cryptoFixture = (): CryptoSnapshot =>
  buildSnapshot({
    org: FIXTURE_ORG,
    type: "CRYPTO",
    rows: SEED_CRYPTO_ROWS,
    now: FIXTURE_NOW,
  });

export const forexFixture = (): ForexSnapshot =>
  buildSnapshot({
    org: FIXTURE_ORG,
    type: "FOREX",
    rows: SEED_FOREX_ROWS,
    now: FIXTURE_NOW,
  });

export const pofFixture = (): PofSnapshot =>
  buildSnapshot({
    org: FIXTURE_ORG,
    type: "POF",
    rows: SEED_POF_ROWS,
    now: FIXTURE_NOW,
  });

// Worst cases (long-text rules): 4 currencies with 7-character prices, one
// with no flag; 6 banks with 14-character short names and 24-character
// notes; no contact line; a logo that can't load; the ₦ glyph.
export const WORST_CASES = {
  "forex-long-prices": (): ForexSnapshot =>
    buildSnapshot({
      org: { ...FIXTURE_ORG, contactLine: null },
      type: "FOREX",
      rows: [
        fx("USD", "US dollar", "us", "12345.50", "12399.75"),
        fx("GBP", "British pound", "gb", "1815.1234", "9999999"),
        fx("EUR", "Euro", "eu", "1560", "1583"),
        fx("XAU", "Gold ounce (no flag)", null, "99999.9", "123456.8"),
      ],
      content: { subheading: "Naira (₦) per unit, settled fast" },
      now: FIXTURE_NOW,
    }),
  "pof-long-names": (): PofSnapshot =>
    buildSnapshot({
      org: { ...FIXTURE_ORG, contactLine: null },
      type: "POF",
      rows: [
        pof(
          "Fourteen Chars Bank",
          "Fourteen Chars",
          "3.40",
          "Twenty-four chars note!!",
        ),
        pof("Providus Bank", "Providus", "3.40", "New account"),
        pof(
          "Broken Logo Bank",
          "Broken Logo",
          "100.00",
          "Existing account",
          "https://logo.invalid/does-not-exist.png",
        ),
        pof(
          "Longname Bank",
          "Abcdefghijklmn",
          "0.05",
          "Twenty-four chars note!!",
        ),
        pof("Short Bank", "Shrt", "12.50", null),
        pof("Another Bank", "Mnopqrstuvwxyz", "99.99", "New account"),
      ],
      now: FIXTURE_NOW,
    }),
  // 6 coins: a 6-character ticker with a 20-character name and two
  // 8-character tags; an icon that can't load (letter badge); no badge
  // colour (theme colour); long prices; no contact line.
  "crypto-long-names": (): CryptoSnapshot =>
    buildSnapshot({
      org: { ...FIXTURE_ORG, contactLine: null },
      type: "CRYPTO",
      rows: [
        coin(
          "WWWWWW",
          "Mmmmmmmmmmmmmmmmmmmm",
          ["ARBITRUM", "OPTIMISM"],
          "#2775CA",
          "1580",
          "1620",
        ),
        coin(
          "MATICX",
          "Polygon Liquid Stake",
          ["Polygon", "Ethereum"],
          "#6B2C91",
          "123456",
          "1234567",
        ),
        coin(
          "USDT",
          "Tether",
          ["TRC20", "BEP20"],
          "#1A9E77",
          "1590.5",
          "1615.25",
          "https://logo.invalid/coin.png",
        ),
        coin("TON", "Toncoin", ["TON"], null, "99999.99", "999999.9"),
        coin("BNB", "BNB", ["BEP20"], "#E0A100", "1560", "1605"),
        coin("SOL", "Solana", [], "#0F9D9A", "1560", "1605"),
      ],
      now: FIXTURE_NOW,
    }),
} as const;
