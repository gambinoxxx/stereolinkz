import { findDealIdByToken } from "@/features/deals/access";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { normalizeRef } from "@/features/deals/refs";
import { getMember } from "@/lib/server/auth";
import { readDealFile } from "@/lib/server/deal-files";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });

// A deal file (invoice, receipt), streamed from the private store. Open to
// a team member of the deal's organization, or to the holder of that deal's
// tracking token (?t=…). Everyone else, and every mistake, gets 404.
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/deals/[ref]/files/[id]">,
) {
  const { ref: rawRef, id } = await ctx.params;
  const ref = normalizeRef(rawRef);
  if (!ref || !/^[a-z0-9]{20,40}$/.test(id)) return notFound();

  let dealId: string | null = null;
  const member = await getMember();
  if (member) {
    const deal = await db.deal.findUnique({
      where: {
        organizationId_ref: { organizationId: member.organizationId, ref },
      },
      select: { id: true },
    });
    dealId = deal?.id ?? null;
  }
  if (!dealId) {
    const token = new URL(request.url).searchParams.get("t");
    const desk = token ? await getDealDeskContext() : null;
    dealId = desk ? await findDealIdByToken(desk.org.id, ref, token) : null;
  }
  if (!dealId) return notFound();

  const file = await db.dealFile.findFirst({
    where: { id, dealId },
    select: {
      blobPathname: true,
      contentType: true,
      originalName: true,
      byteSize: true,
    },
  });
  if (!file) return notFound();
  const blob = await readDealFile(file.blobPathname);
  if (!blob) return notFound();

  const safeName =
    file.originalName.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file";
  return new Response(blob.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.byteSize),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
