import { ForexManager } from "@/features/currencies/components/ForexManager";
import { listCurrenciesWithRates } from "@/features/currencies/queries";
import {
  filterToStatus,
  statusFilter,
} from "@/features/currencies/status-filter";
import { requireMember } from "@/lib/server/auth";

export default async function ForexPage({
  searchParams,
}: PageProps<"/admin/forex">) {
  const { organizationId } = await requireMember();
  const { status } = await searchParams;
  const filter = statusFilter.parse(status);
  const list = await listCurrenciesWithRates(
    organizationId,
    filterToStatus(filter),
  );

  return (
    <ForexManager {...list} filter={filter} now={new Date().toISOString()} />
  );
}
