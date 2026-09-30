import { NextResponse } from "next/server";

import { boardFilename } from "@/features/boards/filename";
import { boardSnapshotV1 } from "@/features/boards/snapshot";
import { getMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

// Streams a board's PNG with a download filename. Node runtime, like every
// route near the render path (code-standards.md → Next.js).
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/boards/[id]/download">,
) {
  const member = await getMember();
  if (!member)
    return NextResponse.json(
      { error: "Sign in to download boards." },
      { status: 401 },
    );

  const { id } = await params;
  // Scoped to the member's org. Another org's board answers 404, never 403,
  // which would tell the caller that it exists (Invariant 7).
  const board = await db.rateBoard.findFirst({
    where: { id, organizationId: member.organizationId },
    select: {
      type: true,
      snapshot: true,
      // The newest image: regenerating (Phase 8) adds one.
      images: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { blobUrl: true },
      },
    },
  });
  const image = board?.images[0];
  if (!board || !image || board.type === "CUSTOM")
    return NextResponse.json({ error: "Board not found." }, { status: 404 });

  const upstream = await fetch(image.blobUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    console.error(
      "[download] blob fetch failed",
      upstream.status,
      image.blobUrl,
    );
    return NextResponse.json(
      { error: "The image couldn't be loaded. Try again." },
      { status: 502 },
    );
  }

  const snapshot = boardSnapshotV1.safeParse(board.snapshot);
  const filename = boardFilename(
    snapshot.success ? snapshot.data.content.brand.name : "",
    board.type,
    snapshot.success ? snapshot.data.content.timeLabel : "",
  );
  const length = upstream.headers.get("content-length");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      ...(length ? { "Content-Length": length } : {}),
    },
  });
}
