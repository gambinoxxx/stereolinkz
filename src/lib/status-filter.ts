import { z } from "zod";

// The All / Active / Inactive filter on list pages (?status=). Anything
// else, or nothing, means All. Each feature decides what Active means.
export const statusFilter = z.enum(["all", "active", "inactive"]).catch("all");

export type StatusFilter = z.infer<typeof statusFilter>;
