import { z } from "zod";

import { PageHeader } from "@/components/shell/page-header";
import { HistoryView } from "@/features/boards/components/HistoryView";
import { historyType } from "@/features/boards/history";
import {
  countBoards,
  getBoardDetail,
  getOrgTimezone,
  listBoards,
} from "@/features/boards/queries";
import { requireMember } from "@/lib/server/auth";

// regenerateBoard runs in this page's function (render + upload), as
// generateBoard does on /admin/generator.
export const maxDuration = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const searchSchema = z.object({
  type: z.preprocess(first, historyType),
  board: z.preprocess(first, z.string().max(64).optional().catch(undefined)),
});

export default async function HistoryPage({
  searchParams,
}: PageProps<"/admin/history">) {
  const { organizationId } = await requireMember();
  const { type, board } = searchSchema.parse(await searchParams);
  const now = new Date();
  // ?board=<id> opens the detail; a missing or another org's id is null.
  const [initial, count, timezone, detail] = await Promise.all([
    listBoards(organizationId, { type }),
    countBoards(organizationId, type),
    getOrgTimezone(organizationId),
    board ? getBoardDetail(organizationId, board, now) : null,
  ]);

  return (
    <>
      <PageHeader
        title="History"
        description="Every board keeps the rates it was generated with, even after the rates change."
      />
      <HistoryView
        type={type}
        count={count}
        initial={initial}
        timezone={timezone}
        now={now.toISOString()}
        detail={detail}
        boardMissing={board !== undefined && detail === null}
      />
    </>
  );
}
