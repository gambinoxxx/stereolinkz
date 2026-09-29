import { ArrowLeftRight } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 4.
export default async function ForexPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="Forex rates"
        description="Naira per unit. Saving a new rate keeps the old one in history, so earlier boards stay accurate."
      />
      <EmptyState
        icon={ArrowLeftRight}
        title="Coming in Phase 4"
        description="Currencies and their buy and sell rates will be listed here."
      />
    </>
  );
}
