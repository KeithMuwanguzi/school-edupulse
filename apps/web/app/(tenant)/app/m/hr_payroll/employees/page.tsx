"use client";

import { HrPayrollEmployeesView } from "@/components/domain/hr_payroll/HrPayrollEmployeesView";
import { HrPayrollModuleGuard } from "@/components/domain/hr_payroll/HrPayrollModuleGuard";

export default function HrPayrollEmployeesPage() {
  return (
    <HrPayrollModuleGuard adminOnly>
      <HrPayrollEmployeesView />
    </HrPayrollModuleGuard>
  );
}
