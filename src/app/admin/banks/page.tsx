import { Landmark } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 3.
export default async function BanksPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="Banks"
        description="Banks are records, not code. Add one here and it’s ready for POF rates and boards straight away."
      />
      <EmptyState
        icon={Landmark}
        title="Coming in Phase 3"
        description="Banks, their logos and status will be managed here."
      />
    </>
  );
}
