import "server-only";

import { del, put } from "@vercel/blob";

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

// Best effort: a leftover blob is harmless, a thrown error here is not.
export async function deleteBlob(urlOrPathname: string): Promise<void> {
  try {
    await del(urlOrPathname);
  } catch (error) {
    console.error("[deleteBlob] could not delete", urlOrPathname, error);
  }
}
