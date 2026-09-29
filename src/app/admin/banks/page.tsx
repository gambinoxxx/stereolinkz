import { Callout } from "@/components/callout";
import { BanksManager } from "@/features/banks/components/BanksManager";
import { listBanks } from "@/features/banks/queries";
import { requireMember } from "@/lib/server/auth";

export default async function BanksPage() {
  const { organizationId } = await requireMember();
  const banks = await listBanks(organizationId);

  return (
    <>
      <BanksManager banks={banks} />
      <Callout className="mt-4">
        Banks with rate history can’t be deleted, because past boards reference
        them. Deactivate them instead: they disappear from new boards and stay
        in history.
      </Callout>
    </>
  );
}
