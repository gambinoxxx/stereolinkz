import "server-only";

import { revalidatePath } from "next/cache";

// The cached public pages (ISR): the landing page and the deal forms
// (/deal/new, every /deal/new/[service] and /deal/new/crypto). They read
// only board snapshots, Settings and our wallets, so the actions that
// change those call this: generating or regenerating a board, General and
// Deal desk settings, adding or deactivating a wallet. Saving a rate or a
// bank changes none of them until a board is generated.
// /deal/[ref] and /admin stay dynamic and are never cached.
// Page paths, not a layout: /deal/new has no layout.tsx of its own, and a
// "layout" revalidation only reaches pages under one.
export function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/deal/new");
  revalidatePath("/deal/new/[service]", "page");
  revalidatePath("/deal/new/crypto");
}
