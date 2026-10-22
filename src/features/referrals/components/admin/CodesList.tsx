import { Badge } from "@/components/ui/badge";
import type { CodeRow } from "@/features/referrals/queries";
import { formatRate } from "@/lib/format";

const naira = (v: string) => `₦${formatRate(v)}`;

// Admin → Referrals, below the ledger: every code with its owner (a team
// member, or a customer by name and masked number), deals and rewards.
// Staff codes are made in Settings → Referrals; customer codes come from
// a completed deal.
export function CodesList({ codes }: { codes: CodeRow[] }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[17px] font-bold tracking-[-0.2px]">Codes</h2>
      {codes.length === 0 ? (
        <p className="text-[14px] text-text-secondary">
          No codes yet. Staff codes are made in Settings → Referrals; customers
          get one when their first deal completes.
        </p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-default bg-bg-surface">
          <div className="hidden grid-cols-[minmax(110px,.8fr)_minmax(180px,1.4fr)_minmax(70px,.4fr)_minmax(140px,1fr)] gap-4 border-b border-border-default bg-bg-subtle px-5 py-2.5 text-[12.5px] font-semibold text-text-muted sheet:grid">
            <span>Code</span>
            <span>Owner</span>
            <span className="text-right">Deals</span>
            <span className="text-right">Rewards</span>
          </div>
          {codes.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3 last:border-b-0 sheet:grid-cols-[minmax(110px,.8fr)_minmax(180px,1.4fr)_minmax(70px,.4fr)_minmax(140px,1fr)] sheet:gap-4 sheet:px-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold">{c.code}</span>
                {!c.active && <Badge variant="destructive">Off</Badge>}
              </div>
              <div className="col-start-1 min-w-0 text-[14px] sheet:col-start-auto">
                <span className="block truncate font-semibold">{c.owner}</span>
                <span className="text-[12.5px] text-text-muted">
                  {c.kind === "STAFF" ? "Team" : "Customer"}
                </span>
              </div>
              <div className="col-start-2 row-start-1 text-right tabular-nums sheet:col-start-auto sheet:row-start-auto">
                {c.deals} deal{c.deals === 1 ? "" : "s"}
              </div>
              <div className="col-start-2 row-start-2 text-right tabular-nums sheet:col-start-auto sheet:row-start-auto">
                <b>{naira(c.rewardsNaira)}</b>
                <span className="block text-[12.5px] text-text-muted">
                  {c.rewards} reward{c.rewards === 1 ? "" : "s"} ·{" "}
                  {naira(c.paidNaira)} paid
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
