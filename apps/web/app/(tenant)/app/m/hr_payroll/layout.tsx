"use client";

import { HrPayrollModuleShell } from "@/components/domain/hr_payroll/HrPayrollModuleShell";

export default function HrPayrollLayout({ children }: { children: React.ReactNode }) {
  return <HrPayrollModuleShell>{children}</HrPayrollModuleShell>;
}
