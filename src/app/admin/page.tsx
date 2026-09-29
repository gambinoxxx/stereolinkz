import { LayoutGrid, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { getViewer, requireMember } from "@/lib/server/auth";

// Placeholder until Phase 9. The design's subtitle starts with today's
// date in the org time zone, which needs the organization row: Phase 9.
export default async function DashboardPage() {
  await requireMember();
  const { firstName } = await getViewer();

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="Update a rate, then generate today’s boards."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/forex">
                <Pencil strokeWidth={1.9} />
                Update rates
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/generator">
                <Sparkles strokeWidth={1.9} />
                Generate board
              </Link>
            </Button>
          </>
        }
      />
      <EmptyState
        icon={LayoutGrid}
        title="Coming in Phase 9"
        description="Today’s rates, recent boards and recent rate changes will be shown here."
      />
    </>
  );
}
