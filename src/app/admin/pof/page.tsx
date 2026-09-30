import { PofManager } from "@/features/pof-rates/components/PofManager";
import {
  listActiveBankOptions,
  listBanksWithoutRate,
  listPofRates,
} from "@/features/pof-rates/queries";
import { requireMember } from "@/lib/server/auth";
import { statusFilter } from "@/lib/status-filter";

export default async function PofPage({
  searchParams,
}: PageProps<"/admin/pof">) {
  const { organizationId } = await requireMember();
  const { status } = await searchParams;
  const filter = statusFilter.parse(status);
  const [list, bankOptions] = await Promise.all([
    listPofRates(organizationId, filter),
    listActiveBankOptions(organizationId),
  ]);

  return (
    <PofManager
      {...list}
      filter={filter}
      now={new Date().toISOString()}
      bankOptions={bankOptions}
      banksWithoutRate={listBanksWithoutRate(bankOptions)}
    />
  );
}
