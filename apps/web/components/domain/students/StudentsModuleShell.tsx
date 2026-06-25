"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const STUDENT_MODULE_TABS = [
  {
    key: "roster",
    label: "Roster",
    href: "/app/m/students",
    description: "Browse and manage enrolled learners by class.",
  },
  {
    key: "term",
    label: "Term check-in",
    href: "/app/m/students/term",
    description: "Register returning learners each term.",
  },
  {
    key: "discipline",
    label: "Discipline",
    href: "/app/m/students/discipline",
    description: "School-wide incident log.",
  },
] as const;

function activeTabKey(pathname: string): string {
  if (pathname.startsWith("/app/m/students/discipline")) return "discipline";
  if (pathname.startsWith("/app/m/students/term") || pathname.startsWith("/app/m/students/registration")) {
    return "term";
  }
  return "roster";
}

interface StudentsModuleShellProps {
  children: React.ReactNode;
}

export function StudentsModuleShell({ children }: StudentsModuleShellProps) {
  const pathname = usePathname();
  const active = activeTabKey(pathname);
  const meta = STUDENT_MODULE_TABS.find((t) => t.key === active);

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {STUDENT_MODULE_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                  active === tab.key
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          {meta && (
            <p className="mt-2 text-[11px] text-slate-500">{meta.description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Routes that use full-page layout without module tabs. */
export function studentsShellHidden(pathname: string): boolean {
  if (pathname === "/app/m/students/enroll" || pathname === "/app/m/students/onboarding") {
    return true;
  }
  if (/^\/app\/m\/students\/registration\/[^/]+$/.test(pathname)) return true;
  if (/^\/app\/m\/students\/[0-9a-f-]{36}$/i.test(pathname)) return true;
  return false;
}
