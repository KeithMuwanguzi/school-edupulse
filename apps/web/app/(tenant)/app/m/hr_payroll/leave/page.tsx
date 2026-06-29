"use client";

import { HrPayrollLeaveView } from "@/components/domain/hr_payroll/HrPayrollLeaveView";
import { HrPayrollModuleGuard } from "@/components/domain/hr_payroll/HrPayrollModuleGuard";

export default function HrPayrollLeavePage() {
  return (
    <HrPayrollModuleGuard adminOnly>
      <HrPayrollLeaveView />
    </HrPayrollModuleGuard>
  );
}
