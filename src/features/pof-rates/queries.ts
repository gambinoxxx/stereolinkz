import "server-only";

import type { RecordStatus } from "@/generated/prisma/enums";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";
import type { StatusFilter } from "@/lib/status-filter";

export type PofRateItem = {
  id: string;
  rate: string; // decimal string, "3.40"
  note: string | null;
  createdAt: string; // ISO
};

export type PofBankItem = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  status: RecordStatus;
  pofActive: boolean;
  // Newest first, at most 4: [0] current, [1] previous (change in pts),
  // all of them the edit drawer's history.
  rates: PofRateItem[];
};

export type PofList = {
  timeZone: string;
  banks: PofBankItem[];
};

const RECENT_RATES = 4;

// Non-archived banks with at least one POF rate, in board order, each with
// its latest rates, in one query. Callers pass requireMember()'s org.
export async function listPofRates(
  organizationId: string,
  filter: StatusFilter = "all",
): Promise<PofList> {
  const shown = { status: "ACTIVE" as const, pofActive: true };
  const [organization, banks] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    }),
    db.bank.findMany({
      where: {
        organizationId,
        status: { not: "ARCHIVED" },
        pofRates: { some: {} },
        ...(filter === "active" ? shown : {}),
        ...(filter === "inactive" ? { NOT: shown } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        pofRates: {
          orderBy: { createdAt: "desc" },
          take: RECENT_RATES,
          select: { id: true, rate: true, note: true, createdAt: true },
        },
      },
    }),
  ]);

  return {
    timeZone: organization.timezone,
    banks: banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName,
      slug: bank.slug,
      logoUrl: bank.logoUrl,
      status: bank.status,
      pofActive: bank.pofActive,
      rates: bank.pofRates.map((rate) => ({
        id: rate.id,
        rate: toDecimalString(rate.rate),
        note: rate.note,
        createdAt: rate.createdAt.toISOString(),
      })),
    })),
  };
}

export type BankOption = {
  id: string;
  name: string;
  shortName: string | null;
  pofActive: boolean;
  currentRate: string | null; // decimal string of the newest rate
};

// ACTIVE banks for the add drawer's select, each with its current rate
// ("Wema Bank (now 3.4%)"); those without one also feed the callout.
export async function listActiveBankOptions(
  organizationId: string,
): Promise<BankOption[]> {
  const banks = await db.bank.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      shortName: true,
      pofActive: true,
      pofRates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { rate: true },
      },
    },
  });
  return banks.map((bank) => ({
    id: bank.id,
    name: bank.name,
    shortName: bank.shortName,
    pofActive: bank.pofActive,
    currentRate: bank.pofRates[0]
      ? toDecimalString(bank.pofRates[0].rate)
      : null,
  }));
}

// ACTIVE banks with no POF rate yet (the callout under the table).
export function listBanksWithoutRate(options: BankOption[]): BankOption[] {
  return options.filter((bank) => bank.currentRate === null);
}
