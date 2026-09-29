import "server-only";

import type { RecordStatus } from "@/generated/prisma/enums";
import { toDecimalString } from "@/lib/decimal";
import { db } from "@/lib/server/db";

// What the banks page needs per bank. Rates cross to the client as strings.
export type BankListItem = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  status: RecordStatus;
  currentRate: { rate: string; note: string | null } | null;
  rateCount: number;
};

// Every bank except ARCHIVED, with its newest POF rate and the number of
// rate records, in one query. Callers pass the organizationId from
// requireMember().
export async function listBanks(
  organizationId: string,
): Promise<BankListItem[]> {
  const banks = await db.bank.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      pofRates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { rate: true, note: true },
      },
      _count: { select: { pofRates: true } },
    },
  });

  return banks.map((bank) => {
    const latest = bank.pofRates[0];
    return {
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName,
      slug: bank.slug,
      logoUrl: bank.logoUrl,
      status: bank.status,
      currentRate: latest
        ? { rate: toDecimalString(latest.rate), note: latest.note }
        : null,
      rateCount: bank._count.pofRates,
    };
  });
}
