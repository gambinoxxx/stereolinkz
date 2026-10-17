import { createHash, timingSafeEqual } from "node:crypto";

import { after } from "next/server";

import { watchAllWallets } from "@/features/crypto-deposits/watch";
import {
  alertOverduePayouts,
  notifyDepositComplete,
} from "@/features/deals/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The deposit watcher's schedule (Vercel Cron daily, plus an external
// scheduler every minute on the Hobby plan). The one route that runs
// without a member (Invariant 7's exception): it needs the CRON_SECRET
// bearer token, reads only our own wallets, and moves deals only through
// transitionDeal as SYSTEM. Answers carry counts, never deal details.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization") ?? "";
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(given), hash(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  if (!authorized(request))
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  const result = await watchAllWallets();
  const overdue = await alertOverduePayouts();
  for (const id of result.completed) after(() => notifyDepositComplete(id));
  return Response.json(
    {
      wallets: result.wallets,
      failed: result.failed,
      completed: result.completed.length,
      overdue,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
