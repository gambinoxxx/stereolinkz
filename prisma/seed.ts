// Seeds the Stereolinkz organization with sample currencies, banks and
// rates. This is the only file where bank and currency names may appear
// (architecture.md → Invariant 1).
//
// Idempotent: parents are upserted on their unique keys and never
// overwritten (so later edits in the app survive a re-run); rate rows are
// inserted only when their parent has none.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, RecordStatus } from "../src/generated/prisma/client";
import { bankSlug } from "../src/features/banks/slug";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Older rate first, then the current one a day later, so "previous rate"
// and change arrows have something to compare.
const now = new Date();
const dayBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);

type SeedForexRate = { buy: string; sell: string };
type SeedCurrency = {
  code: string;
  name: string;
  flagCode: string;
  status: RecordStatus;
  rates: SeedForexRate[];
};

const currencies: SeedCurrency[] = [
  {
    code: "USD",
    name: "US dollar",
    flagCode: "us",
    status: RecordStatus.ACTIVE,
    rates: [
      { buy: "1360", sell: "1374" },
      { buy: "1365", sell: "1378" },
    ],
  },
  {
    code: "GBP",
    name: "British pound",
    flagCode: "gb",
    status: RecordStatus.ACTIVE,
    rates: [
      { buy: "1820", sell: "1845" },
      { buy: "1815", sell: "1840" },
    ],
  },
  {
    code: "EUR",
    name: "Euro",
    flagCode: "eu",
    status: RecordStatus.ACTIVE,
    rates: [
      { buy: "1552", sell: "1578" },
      { buy: "1560", sell: "1583" },
    ],
  },
  {
    code: "CAD",
    name: "Canadian dollar",
    flagCode: "ca",
    status: RecordStatus.INACTIVE,
    rates: [{ buy: "985", sell: "1002" }],
  },
  {
    code: "CNY",
    name: "Chinese yuan",
    flagCode: "cn",
    status: RecordStatus.INACTIVE,
    rates: [{ buy: "188", sell: "194" }],
  },
];

type SeedPofRate = { rate: string; note?: string };
type SeedBank = {
  name: string;
  shortName: string;
  status: RecordStatus;
  rates: SeedPofRate[];
};

const banks: SeedBank[] = [
  {
    name: "Wema Bank",
    shortName: "Wema",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "3.3" }, { rate: "3.4" }],
  },
  {
    name: "Providus Bank",
    shortName: "Providus",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "3.4", note: "New account" }],
  },
  {
    name: "Ecobank",
    shortName: "Ecobank",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "3.4", note: "New account" }],
  },
  {
    name: "Fidelity Bank",
    shortName: "Fidelity",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "3.4", note: "New account" }],
  },
  {
    name: "Parallex Bank",
    shortName: "Parallex",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "2.0" }, { rate: "2.1" }],
  },
  {
    name: "Globus Bank",
    shortName: "Globus",
    status: RecordStatus.ACTIVE,
    rates: [{ rate: "2.3" }],
  },
  {
    name: "Zenith Bank",
    shortName: "Zenith",
    status: RecordStatus.INACTIVE,
    rates: [],
  },
];

// A single rate is the current one; with two, the first is a day older.
function rateDates(count: number): Date[] {
  return count === 2 ? [dayBefore, now] : [now];
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "stereolinkz" },
    update: {},
    create: {
      name: "Stereolinkz",
      slug: "stereolinkz",
      timezone: "Africa/Lagos",
      quoteCurrency: "NGN",
      backgroundColor: "#2A0F58",
      primaryColor: "#6A35D9",
      accentColor: "#E9B949",
      contactLine: "+234 800 000 0000", // placeholder until set in Settings
      defaultForexTemplateKey: "forex/purple-signal",
      defaultPofTemplateKey: "pof/purple-signal",
      defaultFinePrint: "Rates can change without notice.",
    },
  });

  for (const [sortOrder, c] of currencies.entries()) {
    const currency = await prisma.currency.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: c.code },
      },
      update: {},
      create: {
        organizationId: org.id,
        code: c.code,
        name: c.name,
        flagCode: c.flagCode,
        sortOrder,
        status: c.status,
      },
    });

    const existing = await prisma.forexRate.count({
      where: { currencyId: currency.id },
    });
    if (existing === 0) {
      const dates = rateDates(c.rates.length);
      await prisma.forexRate.createMany({
        data: c.rates.map((r, i) => ({
          currencyId: currency.id,
          buy: r.buy,
          sell: r.sell,
          createdAt: dates[i],
        })),
      });
    }
  }

  for (const [sortOrder, b] of banks.entries()) {
    const slug = bankSlug(b.name);
    const bank = await prisma.bank.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      update: {},
      create: {
        organizationId: org.id,
        name: b.name,
        shortName: b.shortName,
        slug,
        sortOrder,
        status: b.status,
        pofActive: true,
      },
    });

    const existing = await prisma.pofRate.count({
      where: { bankId: bank.id },
    });
    if (existing === 0 && b.rates.length > 0) {
      const dates = rateDates(b.rates.length);
      await prisma.pofRate.createMany({
        data: b.rates.map((r, i) => ({
          bankId: bank.id,
          rate: r.rate,
          note: r.note ?? null,
          createdAt: dates[i],
        })),
      });
    }
  }

  const ownerId = process.env.SEED_OWNER_CLERK_USER_ID?.trim();
  if (ownerId) {
    await prisma.membership.upsert({
      where: {
        organizationId_clerkUserId: {
          organizationId: org.id,
          clerkUserId: ownerId,
        },
      },
      update: { role: "OWNER" },
      create: { organizationId: org.id, clerkUserId: ownerId, role: "OWNER" },
    });
    console.log("Owner membership ensured.");
  } else {
    console.warn(
      "⚠ SEED_OWNER_CLERK_USER_ID is not set: skipped the OWNER membership. " +
        "Sign in once, add your Clerk user ID to .env.local and re-run `npm run db:seed`.",
    );
  }

  const counts = {
    Organization: await prisma.organization.count(),
    Membership: await prisma.membership.count(),
    Currency: await prisma.currency.count(),
    ForexRate: await prisma.forexRate.count(),
    Bank: await prisma.bank.count(),
    PofRate: await prisma.pofRate.count(),
    RateBoard: await prisma.rateBoard.count(),
    RateBoardImage: await prisma.rateBoardImage.count(),
  };
  console.table(counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
