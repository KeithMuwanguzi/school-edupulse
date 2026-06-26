"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const FINANCE_MODULE_TABS = [
  {
    key: "accounts",
    label: "Accounts",
    href: "/app/m/finance",
    description: "Generate term invoices and record manual payments.",
  },
  {
    key: "structures",
    label: "Fee structures",
    href: "/app/m/finance/structures",
    description: "Define fee items by class or residence, then activate for invoicing.",
  },
] as const;

function activeTabKey(pathname: string): string {
  if (pathname.startsWith("/app/m/finance/structures")) return "structures";
  return "accounts";
}

interface FinanceModuleShellProps {
  children: React.ReactNode;
}

export function FinanceModuleShell({ children }: FinanceModuleShellProps) {
  const pathname = usePathname();
  const active = activeTabKey(pathname);
  const meta = FINANCE_MODULE_TABS.find((t) => t.key === active);

  return (
    <div className="space-y-4 animate-fade-rise">
      <div>
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FINANCE_MODULE_TABS.map((tab) => (
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
        {meta && <p className="mt-2 text-[11px] text-slate-500">{meta.description}</p>}
      </div>
      {children}
    </div>
  );
}
