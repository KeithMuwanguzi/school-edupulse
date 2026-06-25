"use client";

import { FinanceOverviewView } from "@/components/domain/finance/FinanceOverviewView";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { EmptyState } from "@/components/ui/EmptyState";
import { FINANCE_ROLES, roleHasAny } from "@/lib/roleAccess";
import { useAppSelector } from "@/store/hooks";

export default function FinancePage() {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("finance");

  if (!subscribed) {
    return (
      <EmptyState
        title="Not subscribed"
        description="Finance is not part of your current subscription."
      />
    );
  }

  if (!roleHasAny(user?.role, ...FINANCE_ROLES)) {
    return (
      <AccessDenied
        title="Finance access restricted"
        description="Only school administrators and bursars can view accounts and fees. Contact your school administrator if you need access."
      />
    );
  }

  return <FinanceOverviewView />;
}
