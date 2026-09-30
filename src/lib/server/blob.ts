import "server-only";

import { BlobError, del, head, put } from "@vercel/blob";

import {
  checkImageBytes,
  IMAGE_TYPES,
  type ImageKind,
} from "@/lib/image-check";

// Credentials: on Vercel, @vercel/blob authenticates with the function's
// OIDC token plus BLOB_STORE_ID (added when the store was connected);
// locally it uses BLOB_READ_WRITE_TOKEN from .env.local.

export type ValidImage = {
  ok: true;
  kind: ImageKind;
  contentType: string;
  ext: string;
  bytes: Uint8Array;
};

// Size, real type (magic bytes), SVG safety and the 256px minimum.
export async function validateImage(
  file: File,
): Promise<ValidImage | { ok: false; error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImageBytes(bytes);
  if (!check.ok) return check;
  return { ok: true, kind: check.kind, ...IMAGE_TYPES[check.kind], bytes };
}

// Public, and never overwritten: the random suffix gives every upload a
// new URL (Invariant 12), so boards that reference an old logo keep it.
export async function uploadImage(
  image: ValidImage,
  pathname: string,
): Promise<{ url: string; pathname: string }> {
  const blob = await put(pathname, Buffer.from(image.bytes), {
    access: "public",
    addRandomSuffix: true,
    contentType: image.contentType,
  });
  return { url: blob.url, pathname: blob.pathname };
}

// A generated board PNG at boards/{orgId}/{boardId}/{imageId}.png. The ids
// are fresh UUIDs, so the path is already unique: no random suffix, and
// put() refuses to overwrite an existing blob (Invariant 12).
//
// put() retries after a network error. If the first attempt did store the
// file, the retry is refused with "already exists" (seen on a slow phone
// hotspot). Only this call writes this path, so a blob there with our size
// is our own upload: use it rather than fail the board.
export async function uploadBoardPng(
  png: Uint8Array,
  pathname: string,
): Promise<{ url: string; pathname: string }> {
  try {
    const blob = await put(pathname, Buffer.from(png), {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
    });
    return { url: blob.url, pathname: blob.pathname };
  } catch (error) {
    if (!(error instanceof BlobError) || !/already exists/i.test(error.message))
      throw error;
    const existing = await head(pathname);
    if (existing.size !== png.byteLength) throw error;
    console.warn(
      "[uploadBoardPng] a retried upload had already landed",
      pathname,
    );
    return { url: existing.url, pathname: existing.pathname };
  }
}

// Best effort: a leftover blob is harmless, a thrown error here is not.
export async function deleteBlob(urlOrPathname: string): Promise<void> {
  try {
    await del(urlOrPathname);
  } catch (error) {
    console.error("[deleteBlob] could not delete", urlOrPathname, error);
  }
}
