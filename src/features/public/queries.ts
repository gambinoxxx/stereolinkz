import "server-only";

import {
  type PublicBoardType,
  type PublicLanding,
  type RawBoard,
  showPof,
  toCryptoBoard,
  toForexBoard,
  toPofBoard,
} from "@/features/public/landing-data";
import { db } from "@/lib/server/db";

// The only reads behind the public page (Invariant 13): the organization
// named by PUBLIC_ORG_SLUG, its public fields, and the newest board of
// each type with its newest image. Never ForexRate, PofRate or CryptoRate.
// Bounded: one org, at most one board and one image per type.
export async function getPublicLanding(): Promise<PublicLanding> {
  const slug = process.env.PUBLIC_ORG_SLUG?.trim();
  const empty: PublicLanding = {
    org: null,
    forex: null,
    crypto: null,
    pof: null,
  };
  if (!slug) {
    console.error(
      "[public] PUBLIC_ORG_SLUG is not set; showing the empty page",
    );
    return empty;
  }

  const org = await db.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      backgroundColor: true,
      primaryColor: true,
      accentColor: true,
      contactLine: true,
      email: true,
      timezone: true,
    },
  });
  if (!org) {
    console.error(`[public] No organization with slug "${slug}"`);
    return empty;
  }

  const newest = (type: PublicBoardType): Promise<RawBoard | null> =>
    db.rateBoard.findFirst({
      where: { organizationId: org.id, type },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        snapshot: true,
        snapshotVersion: true,
        createdAt: true,
        images: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { blobUrl: true, width: true, height: true },
        },
      },
    });

  const withPof = showPof(process.env.PUBLIC_SHOW_POF);
  const [forex, crypto, pof] = await Promise.all([
    newest("FOREX"),
    newest("CRYPTO"),
    withPof ? newest("POF") : Promise.resolve(null),
  ]);

  return {
    org: {
      name: org.name,
      logoUrl: org.logoUrl,
      backgroundColor: org.backgroundColor,
      primaryColor: org.primaryColor,
      accentColor: org.accentColor,
      contactLine: org.contactLine,
      email: org.email,
      timezone: org.timezone,
    },
    forex: toForexBoard(forex),
    crypto: toCryptoBoard(crypto),
    pof: toPofBoard(pof),
  };
}
