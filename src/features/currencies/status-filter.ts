import { z } from "zod";

// ?status= on /admin/forex. Anything else (or nothing) means All.
export const statusFilter = z.enum(["all", "active", "inactive"]).catch("all");

export type StatusFilter = z.infer<typeof statusFilter>;

export function filterToStatus(
  filter: StatusFilter,
): "ACTIVE" | "INACTIVE" | undefined {
  return filter === "active"
    ? "ACTIVE"
    : filter === "inactive"
      ? "INACTIVE"
      : undefined;
}
