import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 7.
export default async function GeneratorPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="Generator"
        description="Choose a board, check the preview, then generate a 1080 × 1920 image for WhatsApp Status."
      />
      <EmptyState
        icon={Sparkles}
        title="Coming in Phase 7"
        description="Pick rates and a template, preview the board and generate it here."
      />
    </>
  );
}
