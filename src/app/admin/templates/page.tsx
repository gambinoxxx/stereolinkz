import { Layers } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 6.
export default async function TemplatesPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="Templates"
        description="Templates decide how a board looks. Your rates stay the same whichever one you pick."
      />
      <EmptyState
        icon={Layers}
        title="Coming in Phase 6"
        description="Board designs and their previews will be shown here."
      />
    </>
  );
}
