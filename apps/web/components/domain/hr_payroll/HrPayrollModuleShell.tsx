"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { HR_PAYROLL_SECTIONS } from "@/lib/tenantNav";
import { useAppSelector } from "@/store/hooks";
import { HR_PAYROLL_ROLES, roleHasAny } from "@/lib/roleAccess";

function activeTabKey(pathname: string): string {
  if (pathname.startsWith("/app/m/hr_payroll/employees")) return "employees";
  if (pathname.startsWith("/app/m/hr_payroll/leave")) return "leave";
  if (pathname.startsWith("/app/m/hr_payroll/payroll")) return "payroll";
  if (pathname.startsWith("/app/m/hr_payroll/me")) return "me";
  return "overview";
}

export function HrPayrollModuleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAppSelector((s) => s.auth.user);
  const isAdminSide = roleHasAny(user?.role, ...HR_PAYROLL_ROLES);
  const active = activeTabKey(pathname);
  const tabs = isAdminSide
    ? HR_PAYROLL_SECTIONS
    : HR_PAYROLL_SECTIONS.filter((t) => t.key === "me");
  const meta = tabs.find((t) => t.key === active);

  return (
    <div className="space-y-4 animate-fade-rise">
      <div>
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-3.5",
                active === tab.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        {meta && <p className="mt-2 text-[11px] text-slate-500">{tabDescription(meta.key)}</p>}
      </div>
      {children}
    </div>
  );
}

function tabDescription(key: string): string {
  switch (key) {
    case "overview":
      return "Workforce snapshot — headcount, leave queue, and payroll status.";
    case "employees":
      return "Job details, compensation, TIN/NSSF, and payment method per staff member.";
    case "leave":
      return "Review and approve staff leave requests.";
    case "payroll":
      return "Monthly pay runs with NSSF, PAYE, and payslip generation.";
    case "me":
      return "Your leave requests and finalized payslips.";
    default:
      return "";
  }
}
