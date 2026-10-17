"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select } from "@/features/settings/components/settings-parts";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "needs", label: "Needs action" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

// deals.html .dtool: filter, search (ref, name, phone), service, owner.
// Everything lives in the URL, so a filtered queue can be shared or reloaded.
export function DealsToolbar({
  counts,
  owners,
}: {
  counts: { active: number; needs: number };
  owners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    router.replace(next.size ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  // Search after a short pause in typing.
  useEffect(() => {
    if ((params.get("q") ?? "") === q.trim()) return;
    const id = window.setTimeout(() => update("q", q.trim() || null), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the text changes
  }, [q]);

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <div className="max-w-full overflow-x-auto">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="segmented"
          value={params.get("filter") ?? "active"}
          onValueChange={(next) =>
            next && update("filter", next === "active" ? null : next)
          }
          aria-label="Filter deals"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              className="whitespace-nowrap"
            >
              {f.label}
              {f.value === "active" && (
                <span className="ml-1 text-text-muted">{counts.active}</span>
              )}
              {f.value === "needs" && (
                <span className="ml-1 text-text-muted">{counts.needs}</span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-control border border-border-default bg-bg-surface px-3 text-text-muted shell:max-w-[300px] shell:min-w-[240px]">
        <Search
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={1.9}
        />
        <input
          className="w-full min-w-0 border-0 bg-transparent text-[14.5px] text-text-primary outline-none"
          placeholder="Search ref, name or phone"
          aria-label="Search deals"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="w-auto">
        <Select
          aria-label="Service"
          value={params.get("service") ?? ""}
          onChange={(e) => update("service", e.target.value || null)}
        >
          <option value="">All services</option>
          <option value="school-fees">School fees</option>
          <option value="pay-abroad">International payment</option>
          <option value="pof">Proof of funds</option>
          <option value="forex">Forex</option>
          <option value="crypto">Sell crypto</option>
        </Select>
      </div>
      <div className="w-auto">
        <Select
          aria-label="Owner"
          value={params.get("owner") ?? ""}
          onChange={(e) => update("owner", e.target.value || null)}
        >
          <option value="">Anyone</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </Select>
      </div>
    </div>
  );
}
