import "server-only";

import { revalidatePath } from "next/cache";

import { FORM_SLUGS } from "@/features/deals/services";

// The cached public pages (ISR): the landing page and the deal forms
// (/deal/new, every /deal/new/[service] and /deal/new/crypto). They read
// only board snapshots, Settings and our wallets, so the actions that
// change those call this: generating or regenerating a board, General and
// Deal desk settings, adding or deactivating a wallet. Saving a rate or a
// bank changes none of them until a board is generated.
// /deal/[ref] and /admin stay dynamic and are never cached.
// Literal URLs, one per page. Not a layout: /deal/new has no layout.tsx
// of its own. Not the "/deal/new/[service]" pattern either: patterns
// match the route's file path, which sits in the (public) group, so it
// silently missed the prerendered service pages.
export function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/deal/new");
  for (const slug of FORM_SLUGS) revalidatePath(`/deal/new/${slug}`);
  revalidatePath("/deal/new/crypto");
}
