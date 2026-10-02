import { listCoinsWithRates } from "@/features/coins/queries";
import { filterToStatus } from "@/features/currencies/status-filter";
import { CryptoManager } from "@/features/crypto-rates/components/CryptoManager";
import { requireMember } from "@/lib/server/auth";
import { statusFilter } from "@/lib/status-filter";

export default async function CryptoPage({
  searchParams,
}: PageProps<"/admin/crypto">) {
  const { organizationId } = await requireMember();
  const { status } = await searchParams;
  const filter = statusFilter.parse(status);
  const list = await listCoinsWithRates(organizationId, filterToStatus(filter));

  return (
    <CryptoManager {...list} filter={filter} now={new Date().toISOString()} />
  );
}
