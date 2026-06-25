"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { SETTINGS_SECTIONS } from "@/lib/tenantNav";
import { useAppSelector } from "@/store/hooks";

function SettingsTabs({ pathname }: { pathname: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-center gap-1 border-b border-slate-200/80">
        {SETTINGS_SECTIONS.map((section) => {
          const active =
            pathname === section.href || pathname.startsWith(`${section.href}/`);
          if (!section.implemented) {
            return (
              <span
                key={section.key}
                title="Coming soon"
                className="flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-[11.5px] font-medium text-slate-300"
              >
                {section.label}
                <span className="rounded-full bg-slate-100 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                  Soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={section.key}
              href={section.href}
              className={cn(
                "relative flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11.5px] font-medium transition-colors",
                active
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon name={section.icon} size={13} className={active ? "text-brand-600" : "text-slate-400"} />
              {section.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unknown") return;
    if (user && user.role !== "school_admin") {
      router.replace("/app");
    }
  }, [status, user, router]);

  if (status === "unknown" || !user) return <PageLoader />;

  if (user.role !== "school_admin") {
    return (
      <EmptyState
        icon={<Icon name="settings" size={18} />}
        title="Settings are admin-only"
        description="Ask your school administrator to update school settings."
      />
    );
  }

  const active = SETTINGS_SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );

  return (
    <div className="animate-fade-rise">
      <div className="mb-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          <span aria-hidden className="h-1 w-4 rounded-full bg-gold-400" />
          Administration
        </p>
        <h1 className="mt-1.5 font-display text-[1.45rem] font-medium leading-tight tracking-tight text-slate-900">
          {active?.label ?? "School settings"}
        </h1>
        {active?.description && (
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-500">
            {active.description}
          </p>
        )}
      </div>

      <SettingsTabs pathname={pathname} />

      <div className="mt-5">{children}</div>
    </div>
  );
}
