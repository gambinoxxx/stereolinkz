import { SlidersHorizontal } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/server/auth";

// Placeholder until Phase 9.
export default async function SettingsPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details and brand colours used on every board."
      />
      <EmptyState
        icon={SlidersHorizontal}
        title="Coming in Phase 9"
        description="Company details, contact line and brand colours will be edited here."
      />
    </>
  );
}
