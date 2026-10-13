import "server-only";

// Deal files (invoices, receipts) live in the separate PRIVATE Blob store
// (DEAL_FILES_*), never the public one. The browser uploads straight to it
// with a short-lived token bound to one random pathname, one content type
// and the size limit (Vercel functions can't take 10 MB request bodies);
// then the server checks the stored bytes before recording the file. Files
// are only ever read back here and streamed by the authenticated file
// route; their URLs never reach a browser.
import { randomBytes } from "node:crypto";

import { del, get, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export const MAX_DEAL_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_DEAL = 3;

export const DEAL_FILE_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;
export type DealFileType = keyof typeof DEAL_FILE_TYPES;

export function isDealFileType(value: string): value is DealFileType {
  return value in DEAL_FILE_TYPES;
}

// The store, named explicitly on every call so a missing setting fails
// instead of falling back to the public store.
function store() {
  const token = process.env.DEAL_FILES_READ_WRITE_TOKEN?.trim();
  const storeId = process.env.DEAL_FILES_STORE_ID?.trim();
  if (!token || !storeId)
    throw new Error("The private deal-files store is not configured");
  return { token, storeId };
}

// The magic bytes of each allowed type: the declared type must match.
export function sniffDealFile(bytes: Uint8Array): DealFileType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  return null;
}

export function dealFilePrefix(organizationId: string, dealId: string) {
  return `deals/${organizationId}/${dealId}/`;
}

// deals/{orgId}/{dealId}/{32 random hex}.{ext}
export function isDealFilePath(
  pathname: string,
  organizationId: string,
  dealId: string,
) {
  const prefix = dealFilePrefix(organizationId, dealId);
  return (
    pathname.startsWith(prefix) &&
    /^[0-9a-f]{32}\.(pdf|jpg|png)$/.test(pathname.slice(prefix.length))
  );
}

// A token that lets the browser write exactly one new file, of the
// declared type and at most 10 MB, at a path we chose, for 10 minutes.
export async function issueDealUpload(
  organizationId: string,
  dealId: string,
  contentType: DealFileType,
): Promise<{ pathname: string; clientToken: string }> {
  const { token } = store();
  const pathname = `${dealFilePrefix(organizationId, dealId)}${randomBytes(16).toString("hex")}.${DEAL_FILE_TYPES[contentType]}`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token,
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: MAX_DEAL_FILE_BYTES,
    validUntil: Date.now() + 10 * 60 * 1000,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return { pathname, clientToken };
}

export type CheckedDealFile = {
  url: string;
  pathname: string;
  contentType: DealFileType;
  byteSize: number;
};

// After an upload: the blob must exist, be ≤ 10 MB, and its first bytes
// must be a PDF, JPEG or PNG matching its stored type. Anything else is
// deleted and refused.
export async function checkUploadedDealFile(
  pathname: string,
): Promise<CheckedDealFile | null> {
  const opts = store();
  let meta;
  try {
    meta = await head(pathname, opts);
  } catch {
    return null; // never uploaded
  }
  const reject = async () => {
    await del(meta.url, opts).catch(() => {});
    return null;
  };
  if (meta.size > MAX_DEAL_FILE_BYTES || meta.size < 8) return reject();
  const file = await get(pathname, { access: "private", ...opts });
  if (!file?.stream) return reject();
  const reader = file.stream.getReader();
  const first = await reader.read();
  await reader.cancel().catch(() => {});
  const sniffed = first.value ? sniffDealFile(first.value) : null;
  if (!sniffed || sniffed !== meta.contentType) return reject();
  return { url: meta.url, pathname, contentType: sniffed, byteSize: meta.size };
}

// The file for the authenticated route to stream.
export async function readDealFile(pathname: string) {
  const file = await get(pathname, { access: "private", ...store() });
  return file?.stream ? file : null;
}

export async function deleteDealFile(urlOrPathname: string) {
  await del(urlOrPathname, store()).catch((error) => {
    console.warn(
      "[deleteDealFile] could not delete a deal file",
      error instanceof Error ? error.message : "",
    );
  });
}
