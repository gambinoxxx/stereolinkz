import "server-only";

import { Prisma } from "@/generated/prisma/client";

// P2002: unique constraint failed. P2003: foreign key constraint failed
// (for us: deleting a parent that still has Restrict children). P2025: the
// record to update or delete was not found (another org's id, or gone).
export function isPrismaError(
  error: unknown,
  code: "P2002" | "P2003" | "P2025",
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
