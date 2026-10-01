import { Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { getBoardDetail } from "@/features/boards/queries";
import { DashboardView } from "@/features/dashboard/components/DashboardView";
import { getDashboard } from "@/features/dashboard/queries";
import { formatLongDate } from "@/lib/format";
import { getViewer, requireMember } from "@/lib/server/auth";

// Regenerating from the board detail runs in this page's function.
export const maxDuration = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const searchSchema = z.object({
  board: z.preprocess(first, z.string().max(64).optional().catch(undefined)),
});

export default async function DashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const { organizationId } = await requireMember();
  const { board } = searchSchema.parse(await searchParams);
  const now = new Date();
  const [data, viewer, detail] = await Promise.all([
    getDashboard(organizationId, now),
    getViewer().catch(() => null),
    board ? getBoardDetail(organizationId, board, now) : null,
  ]);

  return (
    <>
      <PageHeader
        title={viewer ? `Good day, ${viewer.firstName}` : "Good day"}
        description={`${formatLongDate(now, data.timeZone)}. Update a rate, then generate today’s boards.`}
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
      <DashboardView
        data={data}
        detail={detail}
        boardMissing={board !== undefined && detail === null}
      />
    </>
  );
}
