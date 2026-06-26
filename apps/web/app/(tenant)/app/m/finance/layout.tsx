"use client";

import { FinanceModuleShell } from "@/components/domain/finance/FinanceModuleShell";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <FinanceModuleShell>{children}</FinanceModuleShell>;
}
