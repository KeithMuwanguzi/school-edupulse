"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/Spinner";
import { buildTenantNavGroups } from "@/lib/tenantNav";
import { useAuthGuard, useLogout } from "@/lib/session";
import { useAcademicContextQuery, useGetTenantSchoolQuery } from "@/store/api/skulpulseApi";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuthGuard("tenant_user", "/");
  const logout = useLogout("/");
  const { data: ctx } = useAcademicContextQuery(undefined, { skip: !ready });
  const { data: school } = useGetTenantSchoolQuery(undefined, { skip: !ready });

  if (!ready || !user) return <PageLoader />;

  const displayName = school?.profile.name ?? user.tenant?.school_code ?? "SkulPulse";

  const navGroups = buildTenantNavGroups(user);
  const topBarPills = [];

  if (ctx?.active_term?.label) {
    topBarPills.push({ label: ctx.active_term.label, tone: "gold" as const });
  }
  if (ctx?.academic_year?.label) {
    topBarPills.push({ label: ctx.academic_year.label, tone: "slate" as const });
  }

  return (
    <AppShell
      brand={displayName}
      brandLogoUrl={school?.profile.badge_url}
      brandSubtitle="School portal"
      homeHref="/app"
      navGroups={navGroups}
      userName={user.name}
      userRole={user.role.replace("_", " ")}
      onLogout={logout}
      topBarPills={topBarPills}
    >
      {children}
    </AppShell>
  );
}
