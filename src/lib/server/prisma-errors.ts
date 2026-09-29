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

// A Postgres CHECK constraint (SQLSTATE 23514) rejected the write. With
// the pg driver adapter Prisma 7 reports it as P2039 and puts the
// Postgres error in meta.driverAdapterError.cause.
export function isCheckViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const cause = (
    error.meta as
      | {
          driverAdapterError?: {
            cause?: { originalCode?: string; originalMessage?: string };
          };
        }
      | undefined
  )?.driverAdapterError?.cause;
  if (cause?.originalCode === "23514")
    return cause.originalMessage?.includes(constraint) ?? false;
  return error.message.includes(constraint); // other adapters or versions
}
