import {
  ArrowLeftRight,
  Coins,
  History,
  Landmark,
  Layers,
  LayoutGrid,
  Percent,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Sidebar groups, separated by a rule (dashboard.html).
export const NAV_GROUPS: NavItem[][] = [
  [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid },
    { href: "/admin/forex", label: "Forex rates", icon: ArrowLeftRight },
    { href: "/admin/pof", label: "POF rates", icon: Percent },
    { href: "/admin/crypto", label: "Crypto rates", icon: Coins },
    { href: "/admin/banks", label: "Banks", icon: Landmark },
  ],
  [
    { href: "/admin/generator", label: "Generator", icon: Sparkles },
    { href: "/admin/history", label: "History", icon: History },
    { href: "/admin/templates", label: "Templates", icon: Layers },
  ],
  [{ href: "/admin/settings", label: "Settings", icon: SlidersHorizontal }],
];

// Phone tab bar; "More" (the full menu) is added by BottomTabBar.
export const TAB_ITEMS: (NavItem & { raised?: boolean })[] = [
  { href: "/admin", label: "Home", icon: LayoutGrid },
  { href: "/admin/forex", label: "Forex", icon: ArrowLeftRight },
  { href: "/admin/pof", label: "POF", icon: Percent },
  { href: "/admin/generator", label: "Generate", icon: Sparkles, raised: true },
];

// The dashboard matches only itself; other items match their sub-routes.
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
