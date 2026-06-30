/** Build parent sidebar from subscribed modules. */
import type { NavGroup } from "@/components/layout/AppShell";
import { parentHasFeature } from "@/lib/parentPortal";

interface ParentNavUser {
  modules: string[];
}

export function buildParentNavGroups(user: ParentNavUser): NavGroup[] {
  const items = [
    { label: "Dashboard", href: "/app", icon: "home", exact: true },
    { label: "Circulars", href: "/app/circulars", icon: "chat" },
  ];

  if (parentHasFeature(user.modules, "reportcards")) {
    items.push({ label: "Report card", href: "/app/parent/report-card", icon: "book" });
  }
  if (parentHasFeature(user.modules, "finance")) {
    items.push({ label: "Fees", href: "/app/parent/fees", icon: "wallet" });
  }

  return [
    { items: [items[0]] },
    { label: "Your child", items: items.slice(1) },
  ];
}
