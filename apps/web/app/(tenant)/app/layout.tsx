"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordGate } from "@/components/auth/ChangePasswordGate";
import { SchoolSetupGate } from "@/components/domain/onboarding/SchoolSetupGate";
import { PageLoader } from "@/components/ui/Spinner";
import { buildTenantNavGroups } from "@/lib/tenantNav";
import { useAuthGuard, useLogout } from "@/lib/session";
import { useAcademicContextQuery, useGetMeQuery, useGetTenantSchoolQuery } from "@/store/api/skulpulseApi";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuthGuard("tenant_user", "/");
  const logout = useLogout("/");
  const { data: me, isLoading: meLoading } = useGetMeQuery(undefined, { skip: !ready });
  const mustChangePassword = me?.must_change_password ?? false;
  const skipTenantApis = !ready || meLoading || mustChangePassword;
  const { data: ctx } = useAcademicContextQuery(undefined, { skip: skipTenantApis });
  const { data: school } = useGetTenantSchoolQuery(undefined, { skip: skipTenantApis });

  if (!ready || !user) return <PageLoader />;

  const isSchoolAdmin = user.role === "school_admin";
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
      {mustChangePassword && <ChangePasswordGate userName={user.name} />}
      {!mustChangePassword && <SchoolSetupGate enabled={isSchoolAdmin} />}
      {children}
    </AppShell>
  );
}
