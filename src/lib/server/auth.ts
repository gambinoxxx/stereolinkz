import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { MemberRole } from "@/generated/prisma/enums";
import { db } from "@/lib/server/db";

export type Member = {
  userId: string;
  organizationId: string;
  role: MemberRole;
};

// A Clerk session is not enough: access comes from our Membership table.
// Cached so one request looks the member up once.
const lookupMember = cache(
  async (): Promise<{ userId: string | null; member: Member | null }> => {
    const { userId } = await auth();
    if (!userId) return { userId: null, member: null };

    // The MVP has one organization; oldest membership wins if there are more.
    const membership = await db.membership.findFirst({
      where: { clerkUserId: userId },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true, role: true },
    });
    return {
      userId,
      member: membership ? { userId, ...membership } : null,
    };
  },
);

// For pages, layouts and server actions: never returns without a member.
export async function requireMember(): Promise<Member> {
  const { userId, member } = await lookupMember();
  if (!userId) redirect("/login");
  if (!member) redirect("/not-authorized");
  return member;
}

// The signed-in person's name for the shell and greetings (from Clerk, not
// our data). Cached so the sidebar and a page share one Clerk call.
export const getViewer = cache(
  async (): Promise<{ firstName: string; fullName: string }> => {
    const user = await currentUser();
    const fallback =
      user?.username ?? user?.primaryEmailAddress?.emailAddress ?? "Member";
    const firstName = user?.firstName?.trim() || fallback;
    const fullName = user?.fullName?.trim() || firstName;
    return { firstName, fullName };
  },
);

// For route handlers that must answer with 401/403 JSON instead of redirecting.
export async function getMember(): Promise<Member | null> {
  return (await lookupMember()).member;
}
