import Link from "next/link";

// "General | Deal desk | Referrals" (settings-deal-desk.html .tabs2),
// under the header.
const TABS = [
  { key: "general", href: "/admin/settings", label: "General" },
  { key: "deal-desk", href: "/admin/settings/deal-desk", label: "Deal desk" },
  { key: "referrals", href: "/admin/settings/referrals", label: "Referrals" },
] as const;

export function SettingsTabs({
  current,
}: {
  current: (typeof TABS)[number]["key"];
}) {
  return (
    <nav
      aria-label="Settings sections"
      className="-mt-1.5 mb-[22px] flex gap-1 border-b border-border-default"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3.5 py-2.5 text-[14.5px] font-[650] text-text-secondary hover:text-text-primary aria-[current=page]:border-accent-primary aria-[current=page]:text-text-primary"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
