import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";

const FALLBACK = "A team member";

// A display name for a Clerk user id (createdById on boards and rates).
// Membership has no name column, so the name comes from Clerk, once per
// request per id. Any failure (deleted user, Clerk down) gives the fallback
// rather than breaking the page.
export const getUserDisplayName = cache(
  async (userId: string | null): Promise<string> => {
    if (!userId) return FALLBACK;
    try {
      const user = await (await clerkClient()).users.getUser(userId);
      return (
        user.fullName?.trim() ||
        user.firstName?.trim() ||
        user.username ||
        user.primaryEmailAddress?.emailAddress ||
        FALLBACK
      );
    } catch (error) {
      console.warn("[getUserDisplayName] lookup failed", userId, error);
      return FALLBACK;
    }
  },
);
