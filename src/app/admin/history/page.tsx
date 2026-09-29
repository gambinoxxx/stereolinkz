import { History } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 8.
export default async function HistoryPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="History"
        description="Every board keeps the rates it was generated with, even after the rates change."
      />
      <EmptyState
        icon={History}
        title="Coming in Phase 8"
        description="Every generated board will be listed here by day."
      />
    </>
  );
}
