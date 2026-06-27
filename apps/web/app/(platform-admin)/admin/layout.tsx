"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordGate } from "@/components/auth/ChangePasswordGate";
import { PageLoader } from "@/components/ui/Spinner";
import { useAuthGuard, useLogout } from "@/lib/session";
import { useGetMeQuery } from "@/store/api/skulpulseApi";

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { label: "Schools", href: "/admin", icon: "building" },
      { label: "Administrators", href: "/admin/admins", icon: "users" },
      { label: "Logs", href: "/admin/logs", icon: "list" },
      { label: "System", href: "/admin/system", icon: "settings" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuthGuard("platform_admin", "/platform/sign-in");
  const logout = useLogout("/platform/sign-in");
  const { data: me, isLoading: meLoading } = useGetMeQuery(undefined, { skip: !ready });

  if (!ready || !user) return <PageLoader />;

  const mustChangePassword = me?.must_change_password ?? false;

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
      {!meLoading && mustChangePassword && (
        <ChangePasswordGate userName={user.name} portal="platform" />
      )}
      {children}
    </AppShell>
  );
}
