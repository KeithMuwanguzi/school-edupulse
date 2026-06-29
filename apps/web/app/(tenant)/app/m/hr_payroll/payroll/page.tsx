"use client";

import { HrPayrollPayrollView } from "@/components/domain/hr_payroll/HrPayrollPayrollView";
import { HrPayrollModuleGuard } from "@/components/domain/hr_payroll/HrPayrollModuleGuard";

export default function HrPayrollPayrollPage() {
  return (
    <HrPayrollModuleGuard adminOnly>
      <HrPayrollPayrollView />
    </HrPayrollModuleGuard>
  );
}
