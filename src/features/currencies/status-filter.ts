import type { StatusFilter } from "@/lib/status-filter";

// Forex: Active / Inactive is Currency.status.
export function filterToStatus(
  filter: StatusFilter,
): "ACTIVE" | "INACTIVE" | undefined {
  return filter === "active"
    ? "ACTIVE"
    : filter === "inactive"
      ? "INACTIVE"
      : undefined;
}
