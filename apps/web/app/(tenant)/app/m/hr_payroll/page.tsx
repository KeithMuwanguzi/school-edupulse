"use client";

import { HrPayrollModuleGuard } from "@/components/domain/hr_payroll/HrPayrollModuleGuard";
import { HrPayrollOverviewView } from "@/components/domain/hr_payroll/HrPayrollOverviewView";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { HR_PAYROLL_ROLES, roleHasAny } from "@/lib/roleAccess";
import { useAppSelector } from "@/store/hooks";

export default function HrPayrollOverviewPage() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <HrPayrollModuleGuard>
      {roleHasAny(user?.role, ...HR_PAYROLL_ROLES) ? (
        <HrPayrollOverviewView />
      ) : (
        <AccessDenied
          title="Overview for administrators"
          description="Use My HR for your leave and payslips."
        />
      )}
    </HrPayrollModuleGuard>
  );
}
