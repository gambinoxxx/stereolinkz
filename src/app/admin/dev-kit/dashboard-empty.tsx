import { DashboardView } from "@/features/dashboard/components/DashboardView";
import type { DashboardData } from "@/features/dashboard/queries";

// The dashboard as a brand-new organization sees it: no currencies, POF
// rates, boards or rate changes. Rendered from empty data, so production
// rows are never hidden or deleted to check it.
const EMPTY: DashboardData = {
  timeZone: "Africa/Lagos",
  now: new Date(0).toISOString(),
  stats: {
    currencies: { active: 0, total: 0 },
    banks: { active: 0, total: 0 },
    boardsToday: { count: 0, lastAt: null },
    lastChange: null,
  },
  forex: [],
  pof: [],
  bankOptions: [],
  boards: [],
  changes: [],
};

export function DashboardEmpty() {
  return <DashboardView data={EMPTY} detail={null} boardMissing={false} />;
}
