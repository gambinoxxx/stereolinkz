import { Callout } from "@/components/callout";
import { PageHeader } from "@/components/shell/page-header";
import { BanksTable } from "@/features/banks/components/BanksTable";
import { listBanks } from "@/features/banks/queries";
import { requireMember } from "@/lib/server/auth";

export default async function BanksPage() {
  const { organizationId } = await requireMember();
  const banks = await listBanks(organizationId);

  return (
    <>
      <PageHeader
        title="Banks"
        description="Banks are records, not code. Add one here and it’s ready for POF rates and boards straight away."
      />
      <BanksTable banks={banks} />
      <Callout className="mt-4">
        Banks with rate history can’t be deleted, because past boards reference
        them. Deactivate them instead: they disappear from new boards and stay
        in history.
      </Callout>
    </>
  );
}
