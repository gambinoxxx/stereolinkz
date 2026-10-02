import "server-only";

import type { BoardSnapshot } from "@/features/boards/snapshot";

const TIMEOUT_MS = 3000;
const MAX_BYTES = 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

// Fetches one image and returns it as a data URI, or null on any failure
// (timeout, HTTP error, wrong type, over 1 MB): the template then draws the
// monogram or wordmark instead of failing the whole board.
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!IMAGE_TYPES.includes(type)) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

// A copy of the snapshot with every image URL (brand logo, POF bank logos,
// crypto coin icons) replaced
// by a data URI, fetched in parallel. For rendering only: the stored
// snapshot keeps its URLs and is never changed (Invariant 3).
export async function embedImages<S extends BoardSnapshot>(
  snapshot: S,
): Promise<S> {
  const brandLogo = toDataUri(snapshot.content.brand.logoUrl);
  const content = { ...snapshot.content, brand: { ...snapshot.content.brand } };
  if (snapshot.type === "POF") {
    const logos = await Promise.all(
      snapshot.rows.map((row) => toDataUri(row.logoUrl)),
    );
    content.brand.logoUrl = await brandLogo;
    return {
      ...snapshot,
      content,
      rows: snapshot.rows.map((row, i) => ({
        ...row,
        logoUrl: logos[i] ?? null,
      })),
    };
  }
  if (snapshot.type === "CRYPTO") {
    // Coin icons; one that can't be fetched becomes null, and the board
    // shows the letter badge instead.
    const icons = await Promise.all(
      snapshot.rows.map((row) => toDataUri(row.iconUrl)),
    );
    content.brand.logoUrl = await brandLogo;
    return {
      ...snapshot,
      content,
      rows: snapshot.rows.map((row, i) => ({
        ...row,
        iconUrl: icons[i] ?? null,
      })),
    };
  }
  content.brand.logoUrl = await brandLogo;
  return { ...snapshot, content };
}
