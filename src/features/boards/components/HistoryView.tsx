"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BoardDetailDialog } from "@/features/boards/components/BoardDetailDialog";
import { HistoryList } from "@/features/boards/components/HistoryList";
import { RegenerateDialog } from "@/features/boards/components/RegenerateDialog";
import type { BoardListItem, HistoryType } from "@/features/boards/history";
import type { BoardDetail } from "@/features/boards/queries";

type HistoryViewProps = {
  type: HistoryType;
  count: number;
  initial: { boards: BoardListItem[]; nextCursor: string | null };
  timezone: string;
  now: string;
  detail: BoardDetail | null; // loaded on the server from ?board=
  boardMissing: boolean; // ?board= pointed at nothing we can show
};

// The history page's client side: the list, the detail dialog and the
// regenerate dialog. The open board lives in the URL (?board=<id>), so a
// board can be linked (Phase 7's "View in history").
export function HistoryView({
  type,
  detail,
  boardMissing,
  ...props
}: HistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Closes at once; the URL catches up without a reload or scroll jump.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<BoardListItem | null>(null);

  function setBoardParam(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("board", id);
    else params.delete("board");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (!boardMissing) return;
    toast.error("That board couldn't be found.");
    const params = new URLSearchParams(window.location.search);
    params.delete("board");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [boardMissing, pathname, router]);

  return (
    <>
      <HistoryList
        // A new filter starts a new list.
        key={type ?? "ALL"}
        type={type}
        {...props}
        onView={(board) => {
          setDismissed(null);
          setBoardParam(board.id);
        }}
        onRegenerate={setRegenerating}
      />
      <BoardDetailDialog
        board={detail && detail.id !== dismissed ? detail : null}
        onClose={() => {
          if (detail) setDismissed(detail.id);
          setBoardParam(null);
        }}
        onRegenerate={setRegenerating}
      />
      {/* Opens over the detail when started from there. */}
      <RegenerateDialog
        board={regenerating}
        onClose={() => setRegenerating(null)}
      />
    </>
  );
}
