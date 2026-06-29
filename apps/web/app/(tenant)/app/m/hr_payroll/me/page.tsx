"use client";

import { HrPayrollMeView } from "@/components/domain/hr_payroll/HrPayrollMeView";
import { HrPayrollModuleGuard } from "@/components/domain/hr_payroll/HrPayrollModuleGuard";

export default function HrPayrollMePage() {
  return (
    <HrPayrollModuleGuard>
      <HrPayrollMeView />
    </HrPayrollModuleGuard>
  );
}
