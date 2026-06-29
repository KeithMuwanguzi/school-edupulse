"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AccessDenied } from "@/components/ui/AccessDenied";
import {
  HR_PAYROLL_ROLES,
  HR_STAFF_SELF_SERVICE_ROLES,
  roleHasAny,
} from "@/lib/roleAccess";
import { useAppSelector } from "@/store/hooks";

export function HrPayrollModuleGuard({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("hr_payroll");

  if (!subscribed) {
    return (
      <EmptyState
        title="Not subscribed"
        description="HR & Payroll is not part of your current subscription. Ask your administrator to enable it under Settings → Modules."
      />
    );
  }

  if (adminOnly && !roleHasAny(user?.role, ...HR_PAYROLL_ROLES)) {
    return (
      <AccessDenied
        title="Admin access required"
        description="Only school administrators and bursars can manage employee records and payroll runs."
      />
    );
  }

  if (!roleHasAny(user?.role, ...HR_STAFF_SELF_SERVICE_ROLES)) {
    return (
      <AccessDenied
        title="Staff access only"
        description="HR & Payroll is for school staff. Parent accounts cannot access this module."
      />
    );
  }

  return <>{children}</>;
}
