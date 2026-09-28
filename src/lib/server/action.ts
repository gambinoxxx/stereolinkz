import "server-only";

import { unstable_rethrow } from "next/navigation";

import { type Member, requireMember } from "@/lib/server/auth";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Something went wrong. Try again.";

// Wraps a server action: checks membership first, passes the member in,
// and turns unexpected errors into a generic message. The real error is
// logged on the server only; Prisma or stack-trace text never reaches the
// client. Known failures should be returned as { ok: false } by `fn`.
export function safeAction<Args extends unknown[], T>(
  fn: (member: Member, ...args: Args) => Promise<ActionResult<T>>,
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args) => {
    const member = await requireMember();
    try {
      return await fn(member, ...args);
    } catch (error) {
      // Let redirect() / notFound() from inside `fn` through.
      unstable_rethrow(error);
      console.error("[safeAction]", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  };
}
