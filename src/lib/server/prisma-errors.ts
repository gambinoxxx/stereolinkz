import "server-only";

import { Prisma } from "@/generated/prisma/client";

// P2002: unique constraint failed. P2025: the record to update or delete
// was not found (for us: another org's id, or already deleted).
export function isPrismaError(
  error: unknown,
  code: "P2002" | "P2025",
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
