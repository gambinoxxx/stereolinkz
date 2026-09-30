"use client";

import { CheckCircle2, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { GeneratedBoard } from "@/features/boards/actions";

type GeneratedPanelProps = {
  board: GeneratedBoard;
  fileName: string; // "stereolinkz-forex-1025am.png"
  onStartOver: () => void;
  startingOver: boolean;
};

// Can this browser share files (mostly phones)? Checked with a stand-in
// file: canShare looks at the type, not the bytes.
function canShareImages(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({
      files: [new File([], "board.png", { type: "image/png" })],
    });
  } catch {
    return false;
  }
}

// generator-done.html. Download saves the PNG (on iPhone it goes to Files);
// Share opens the share sheet, which is how the image gets to WhatsApp
// Status or "Save Image" (Photos) on a phone.
export function GeneratedPanel({
  board,
  fileName,
  onStartOver,
  startingOver,
}: GeneratedPanelProps) {
  const download = `/api/boards/${board.boardId}/download`;
  const [shareable] = useState(canShareImages);
  // Fetched ahead: Safari only allows share() straight after the tap, so
  // the file must be ready before it.
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!shareable) return;
    let cancelled = false;
    fetch(download)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!cancelled)
          setFile(new File([blob], fileName, { type: "image/png" }));
      })
      .catch((error) => console.error("[share] could not load the PNG", error));
    return () => {
      cancelled = true;
    };
  }, [shareable, download, fileName]);

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      // Closing the share sheet is not an error.
      if ((error as Error).name !== "AbortError")
        toast.error("Couldn't open sharing. Use Download PNG instead.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-state-success-soft p-4">
      <p
        role="status"
        className="flex items-center gap-2.5 font-bold text-state-success"
      >
        <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={1.9} />
        Board generated at {board.generatedAtLabel}
      </p>
      <p className="text-[13.5px] text-text-secondary">
        Saved to history with its rate snapshot.
        {board.savedRates > 0 &&
          ` ${board.savedRates} edited ${board.savedRates === 1 ? "rate was" : "rates were"} saved as current.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={download} download={fileName}>
            <Download aria-hidden="true" strokeWidth={1.9} />
            Download PNG
          </a>
        </Button>
        {shareable && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!file}
            onClick={share}
          >
            <Share2 aria-hidden="true" strokeWidth={1.9} />
            Share
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/history?board=${board.boardId}`}>
            View in history
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={startingOver}
          onClick={onStartOver}
        >
          {startingOver ? "Loading current rates…" : "Make another"}
        </Button>
      </div>
    </div>
  );
}
