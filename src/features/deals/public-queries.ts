import "server-only";

// What the public deal pages read (Invariant 14): the public organization
// (PUBLIC_ORG_SLUG), which services it has switched on, and the latest
// Forex and POF board snapshots for estimates. Never the rate tables.
// Cached with the pages that read it (ISR; revalidatePublicPages).
import { cache } from "react";

import { readSnapshot } from "@/features/boards/history";
import { isProgrammeActive } from "@/features/referrals/rules";
import type { QuoteBoards } from "@/features/deals/quote";
import type { DealService } from "@/generated/prisma/enums";
import { db } from "@/lib/server/db";

export type DealForexRow = {
  code: string;
  name: string;
  flagCode: string | null;
  buy: string;
  sell: string;
};
export type DealPofRow = {
  bankId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  rate: string;
  note: string | null;
};

export type DealDeskContext = {
  org: {
    id: string;
    name: string;
    contactLine: string | null;
    servicesEnabled: DealService[];
    defaultOwnerId: string | null;
    // Phase 13c: the services the referral programme is on for right now
    // (empty while it's off); the forms show the code field for these.
    referralServices: DealService[];
  };
  forex: {
    boardId: string;
    timeLabel: string;
    dateLabel: string;
    rows: DealForexRow[];
  } | null;
  pof: {
    boardId: string;
    timeLabel: string;
    dateLabel: string;
    rows: DealPofRow[];
  } | null;
};

async function newestBoard(organizationId: string, type: "FOREX" | "POF") {
  const board = await db.rateBoard.findFirst({
    where: { organizationId, type },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, snapshot: true, snapshotVersion: true },
  });
  if (!board) return null;
  const snapshot = readSnapshot(board.snapshotVersion, board.snapshot);
  if (snapshot?.type !== type) {
    console.error(
      `[deals] ${type} board ${board.id} has an unreadable snapshot`,
    );
    return null;
  }
  return { id: board.id, snapshot };
}

export const getDealDeskContext = cache(
  async (): Promise<DealDeskContext | null> => {
    const slug = process.env.PUBLIC_ORG_SLUG?.trim();
    if (!slug) return null;
    const org = await db.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        contactLine: true,
        dealServicesEnabled: true,
        dealDefaultOwnerId: true,
        referralEnabled: true,
        referralStartsAt: true,
        referralEndsAt: true,
        referralServices: true,
      },
    });
    if (!org) return null;
    const [fx, pof] = await Promise.all([
      newestBoard(org.id, "FOREX"),
      newestBoard(org.id, "POF"),
    ]);
    return {
      org: {
        id: org.id,
        name: org.name,
        contactLine: org.contactLine,
        servicesEnabled: org.dealServicesEnabled,
        defaultOwnerId: org.dealDefaultOwnerId,
        referralServices: isProgrammeActive(org, new Date())
          ? org.referralServices
          : [],
      },
      forex:
        fx?.snapshot.type === "FOREX"
          ? {
              boardId: fx.id,
              timeLabel: fx.snapshot.content.timeLabel,
              dateLabel: fx.snapshot.content.dateLabel,
              rows: fx.snapshot.rows.map(
                ({ code, name, flagCode, buy, sell }) => ({
                  code,
                  name,
                  flagCode,
                  buy,
                  sell,
                }),
              ),
            }
          : null,
      pof:
        pof?.snapshot.type === "POF"
          ? {
              boardId: pof.id,
              timeLabel: pof.snapshot.content.timeLabel,
              dateLabel: pof.snapshot.content.dateLabel,
              rows: pof.snapshot.rows.map(
                ({ bankId, name, shortName, logoUrl, rate, note }) => ({
                  bankId,
                  name,
                  shortName,
                  logoUrl,
                  rate,
                  note,
                }),
              ),
            }
          : null,
    };
  },
);

// The quote inputs, from the same context.
export function quoteBoardsOf(ctx: DealDeskContext): QuoteBoards {
  return {
    forex: ctx.forex && {
      boardId: ctx.forex.boardId,
      timeLabel: ctx.forex.timeLabel,
      dateLabel: ctx.forex.dateLabel,
      rows: ctx.forex.rows,
    },
    pof: ctx.pof && {
      boardId: ctx.pof.boardId,
      timeLabel: ctx.pof.timeLabel,
      dateLabel: ctx.pof.dateLabel,
      rows: ctx.pof.rows.map((r) => ({
        bankId: r.bankId,
        name: r.shortName ?? r.name,
        rate: r.rate,
      })),
    },
  };
}
