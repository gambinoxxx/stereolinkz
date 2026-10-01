import "server-only";

import type { BoardSnapshot } from "@/features/boards/snapshot";
import type { BoardTemplate } from "@/features/templates/types";
import type { Prisma } from "@/generated/prisma/client";
import { renderBoardPng } from "@/lib/render/render-board";
import { deleteBlob, uploadBoardPng } from "@/lib/server/blob";
import { db } from "@/lib/server/db";

export type StoredImage = {
  imageId: string;
  url: string;
  pathname: string;
  byteSize: number;
  width: number;
  height: number;
};

export type StoreResult =
  | {
      ok: true;
      image: StoredImage;
      timings: { renderMs: number; uploadMs: number; saveMs: number };
    }
  | { ok: false; stage: "render" | "upload" | "save"; error: unknown };

// The one path from a snapshot to a stored board image, shared by
// generateBoard and regenerateBoard:
//   1. render (nothing written yet)
//   2. upload to boards/{orgId}/{boardId}/{imageId}.png (fresh id, no
//      suffix, never overwrites: Invariant 12)
//   3. one transaction with the caller's writes (all or nothing)
// A failed upload or transaction deletes the blob, best effort, so no
// image is left without a row.
export async function renderAndStore({
  snapshot,
  template,
  organizationId,
  boardId,
  writes,
}: {
  snapshot: BoardSnapshot;
  template: BoardTemplate;
  organizationId: string;
  boardId: string;
  writes: (image: StoredImage) => Prisma.PrismaPromise<unknown>[];
}): Promise<StoreResult> {
  let rendered;
  try {
    rendered = await renderBoardPng(snapshot, template.key);
  } catch (error) {
    return { ok: false, stage: "render", error };
  }

  const imageId = crypto.randomUUID();
  const pathname = `boards/${organizationId}/${boardId}/${imageId}.png`;
  const uploadStarted = performance.now();
  let blob;
  try {
    blob = await uploadBoardPng(rendered.png, pathname);
  } catch (error) {
    // A timed-out upload may still have landed; the path is ours alone.
    await deleteBlob(pathname);
    return { ok: false, stage: "upload", error };
  }
  const uploadMs = Math.round(performance.now() - uploadStarted);

  const image: StoredImage = {
    imageId,
    url: blob.url,
    pathname: blob.pathname,
    byteSize: rendered.png.byteLength,
    width: rendered.width,
    height: rendered.height,
  };

  const saveStarted = performance.now();
  try {
    await db.$transaction(writes(image));
  } catch (error) {
    await deleteBlob(blob.url);
    return { ok: false, stage: "save", error };
  }

  return {
    ok: true,
    image,
    timings: {
      renderMs: rendered.ms,
      uploadMs,
      saveMs: Math.round(performance.now() - saveStarted),
    },
  };
}

// The RateBoardImage row for a stored image, with the template that drew it.
export function imageRow(
  image: StoredImage,
  boardId: string,
  template: BoardTemplate,
  createdById: string,
): Prisma.PrismaPromise<unknown> {
  return db.rateBoardImage.create({
    data: {
      id: image.imageId,
      rateBoardId: boardId,
      format: "story",
      width: image.width,
      height: image.height,
      templateKey: template.key,
      templateVersion: template.version,
      blobUrl: image.url,
      blobPathname: image.pathname,
      byteSize: image.byteSize,
      createdById,
    },
  });
}
