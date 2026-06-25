"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/Spinner";
import { useAuthGuard, useLogout } from "@/lib/session";

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { label: "Schools", href: "/admin", icon: "building" },
      { label: "Logs", href: "/admin/logs", icon: "list" },
      { label: "System", href: "/admin/system", icon: "settings" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuthGuard("platform_admin", "/platform/sign-in");
  const logout = useLogout("/platform/sign-in");

  if (!ready || !user) return <PageLoader />;

  return (
    <AppShell
      brand="SkulPulse Admin"
      brandSubtitle="Platform console"
      homeHref="/admin"
      navGroups={NAV_GROUPS}
      userName={user.name}
      userRole="Platform admin"
      onLogout={logout}
      topBarPills={[{ label: "Platform admin", tone: "slate" }]}
    >
      {children}
    </AppShell>
  );
}
