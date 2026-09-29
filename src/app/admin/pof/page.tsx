import { Percent } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 5.
export default async function PofPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="POF rates"
        description="Proof of funds rate per bank, charged per month. Only active rates appear on POF boards."
      />
      <EmptyState
        icon={Percent}
        title="Coming in Phase 5"
        description="Each bank’s POF rate and note will be listed here."
      />
    </>
  );
}
