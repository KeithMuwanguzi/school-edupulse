"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { parentHasFeature } from "@/lib/parentPortal";
import type { ParentPortalOverviewOut } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import {
  useGetParentOverviewQuery,
  useGetTenantSchoolQuery,
  useListCircularInboxQuery,
} from "@/store/api/skulpulseApi";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function childName(child: ParentPortalOverviewOut["child"]): string {
  return child.preferred_name?.trim() || `${child.first_name} ${child.last_name}`.trim();
}

function classPlacement(child: ParentPortalOverviewOut["child"]): string {
  const parts = [child.class_label, child.stream_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Class not assigned";
}

function formatUgx(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "gold" | "blue" | "slate";
}

const toneStyles = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-200/70",
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200/70",
};

function StatCard({ icon, label, value, hint, tone = "brand" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
            toneStyles[tone],
          )}
        >
          <Icon name={icon} size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            {label}
          </p>
          <p className="mt-0.5 font-display text-[1.25rem] font-medium leading-none tracking-tight text-slate-900">
            {value}
          </p>
          {hint ? <p className="mt-1 text-[10.5px] text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ParentDashboardView({ userName }: { userName?: string }) {
  const modules = useAppSelector((s) => s.auth.user?.modules ?? []);
  const { data: school } = useGetTenantSchoolQuery();
  const { data: overview, isLoading, isError } = useGetParentOverviewQuery();
  const { data: circulars = [] } = useListCircularInboxQuery();

  if (isLoading) return <PageLoader />;
  if (isError || !overview) {
    return (
      <EmptyState
        icon={<Icon name="user" size={18} />}
        title="Portal unavailable"
        description="We could not load your child's profile. Contact the school office if this continues."
      />
    );
  }

  const child = overview.child;
  const displayChild = childName(child);
  const firstName = userName?.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-5 animate-fade-rise">
      <section className="relative overflow-hidden rounded-2xl border border-brand-800/40 bg-brand-700 text-white shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(620px 320px at 88% -10%, rgba(229,166,39,0.22) 0%, transparent 60%), radial-gradient(520px 360px at 0% 120%, rgba(15,40,36,0.55) 0%, transparent 60%)",
          }}
        />
        <div className="relative px-5 py-5 sm:px-6 sm:py-6">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
            <span aria-hidden className="h-1 w-4 rounded-full bg-gold-400" />
            {greeting()}, {firstName}
          </p>
          <h1 className="mt-2 font-display text-[1.6rem] font-medium leading-tight tracking-tight sm:text-[1.9rem]">
            {displayChild}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-brand-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 font-semibold ring-1 ring-white/15">
              {classPlacement(child)}
            </span>
            <span className="text-brand-200/80">No. {child.student_number}</span>
          </div>
          <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-brand-100/90">
            This portal login is shared by all guardians listed for {displayChild}. Username{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-white">
              {overview.portal_username}
            </code>
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="chat"
          label="School circulars"
          value={String(overview.circular_count)}
          hint={overview.circular_count === 1 ? "notice available" : "notices available"}
          tone="brand"
        />
        <StatCard
          icon="percent"
          label="Attendance"
          value={overview.attendance_rate == null ? "—" : `${overview.attendance_rate}%`}
          hint={
            overview.attendance_rate == null ? "Not recorded yet this term" : "This term so far"
          }
          tone="gold"
        />
        <StatCard
          icon="wallet"
          label="Fee balance"
          value={
            overview.fee == null
              ? "—"
              : overview.fee.balance_ugx === 0
                ? "Clear"
                : formatUgx(overview.fee.balance_ugx)
          }
          hint={
            overview.fee == null
              ? "No invoice for this term"
              : overview.fee.is_overdue
                ? "Payment overdue"
                : overview.fee.term_label
          }
          tone={overview.fee?.is_overdue ? "gold" : "blue"}
        />
        <StatCard
          icon="users"
          label="Guardians"
          value={String(overview.guardians.length)}
          hint="Share the same portal login"
          tone="slate"
        />
      </div>

      {(parentHasFeature(modules, "reportcards") || parentHasFeature(modules, "finance")) && (
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-[12px] font-semibold tracking-tight text-slate-900">
              Quick links
            </h2>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {parentHasFeature(modules, "reportcards") ? (
              <Link
                href="/app/parent/report-card"
                className="group flex items-center gap-3 rounded-lg border border-slate-200/80 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Icon name="book" size={16} />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-slate-900">
                    Report card
                  </span>
                  <span className="block text-[10.5px] text-slate-500">View term results</span>
                </span>
              </Link>
            ) : null}
            {parentHasFeature(modules, "finance") ? (
              <Link
                href="/app/parent/fees"
                className="group flex items-center gap-3 rounded-lg border border-slate-200/80 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Icon name="wallet" size={16} />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-slate-900">Fees</span>
                  <span className="block text-[10.5px] text-slate-500">
                    Invoices and payments
                  </span>
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon name="chat" size={13} />
              </span>
              <h2 className="text-[12px] font-semibold tracking-tight text-slate-900">
                Recent circulars
              </h2>
            </div>
            <Link
              href="/app/circulars"
              className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </div>
          <div className="px-4 py-3">
            {circulars.length === 0 ? (
              <p className="text-[11px] text-slate-500">No notices from school yet.</p>
            ) : (
              <ul className="space-y-2">
                {circulars.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link
                      href="/app/circulars"
                      className="block rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                    >
                      <span className="block truncate text-[11.5px] font-medium text-slate-800">
                        {c.title}
                      </span>
                      {c.priority === "important" ? (
                        <Badge tone="gold">Important</Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-[12px] font-semibold tracking-tight text-slate-900">
              Guardians on file
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              All listed contacts use the same login for {school?.profile?.name ?? "your school"}.
            </p>
          </div>
          <ul className="divide-y divide-slate-100 px-4 py-1">
            {overview.guardians.length === 0 ? (
              <li className="py-3 text-[11px] text-slate-500">No guardian contacts recorded.</li>
            ) : (
              overview.guardians.map((g) => (
                <li key={`${g.relationship}-${g.full_name}`} className="flex items-center gap-2 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Icon name="user" size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-slate-800">
                      {g.full_name}
                    </span>
                    <span className="block truncate text-[10.5px] capitalize text-slate-500">
                      {g.relationship.replace("_", " ")}
                      {g.is_primary ? " · Primary contact" : ""}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
