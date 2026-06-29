"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { formatUGX } from "@/lib/cn";
import { HR_BEST_PRACTICES } from "@/lib/hrPayrollMeta";
import {
  useHrPayrollSummaryQuery,
  useListLeaveRequestsQuery,
} from "@/store/api/skulpulseApi";

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-display text-[1.35rem] font-medium tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      <span className={`mt-3 inline-block h-1 w-8 rounded-full ${accent}`} />
    </div>
  );
}

export function HrPayrollOverviewView() {
  const { data: summary, isLoading, isError } = useHrPayrollSummaryQuery();
  const { data: pendingLeave = [] } = useListLeaveRequestsQuery({ status: "pending" });

  if (isLoading) return <PageLoader />;
  if (isError || !summary) return <ErrorBanner message="Unable to load HR overview." />;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="HR & Payroll"
        title="Workforce overview"
        description="Central place for staff records, leave, and monthly pay — one source of truth for your school."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active staff"
          value={String(summary.active_employees)}
          hint="With portal accounts in staff roles"
          accent="bg-brand-500"
        />
        <StatCard
          label="Pending leave"
          value={String(summary.pending_leave)}
          hint="Awaiting head teacher approval"
          accent="bg-amber-500"
        />
        <StatCard
          label="On leave today"
          value={String(summary.on_leave_today)}
          hint="Approved and in date range"
          accent="bg-sky-500"
        />
        <StatCard
          label="Monthly gross"
          value={formatUGX(summary.monthly_payroll_ugx)}
          hint="Sum of active salary packages"
          accent="bg-emerald-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Latest payroll run"
            description={
              summary.latest_payroll_label
                ? `${summary.latest_payroll_label} · Net ${formatUGX(summary.latest_payroll_net_ugx ?? 0)}`
                : "No pay run created yet."
            }
            action={
              <Link
                href="/app/m/hr_payroll/payroll"
                className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
              >
                Open payroll
              </Link>
            }
          />
          <CardBody className="text-[12px] text-slate-600">
            Create a monthly run, compute NSSF/PAYE, review totals, then finalize so staff can
            download payslips under My HR.
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Leave queue"
            action={
              pendingLeave.length > 0 ? (
                <Badge tone="amber">{pendingLeave.length} pending</Badge>
              ) : undefined
            }
          />
          <CardBody>
            {pendingLeave.length === 0 ? (
              <p className="text-[12px] text-slate-500">No leave requests waiting for approval.</p>
            ) : (
              <ul className="space-y-2">
                {pendingLeave.slice(0, 4).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                  >
                    <span className="font-medium text-slate-800">{r.employee_name}</span>
                    <span className="text-slate-500">
                      {r.leave_type_label} · {r.days}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/app/m/hr_payroll/leave"
              className="mt-3 inline-flex text-[11px] font-medium text-brand-600"
            >
              Review leave →
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<Icon name="sparkles" size={13} />}
          title="Getting the most from HR & Payroll"
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2">
            {HR_BEST_PRACTICES.map((tip) => (
              <li key={tip.title} className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100">
                <p className="text-[12px] font-semibold text-slate-800">{tip.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{tip.body}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
