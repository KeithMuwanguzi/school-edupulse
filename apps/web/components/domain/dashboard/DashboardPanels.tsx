"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatUGX } from "@/lib/cn";
import { classLabel, fmtTime } from "@/components/domain/timetable/timetableUtils";
import { MetricRow, PanelCard, ProgressBar } from "./PanelCard";
import { pct } from "./dashboardUtils";
import type { StaffDashboardData } from "./useStaffDashboardData";

function AttendanceTodayPanel({ data }: { data: StaffDashboardData }) {
  const { attendance } = data;
  if (!attendance) return null;

  const marked = attendance.total_marked;
  const rate = pct(attendance.present, marked);
  const unmarked = Math.max(0, attendance.total_enrolled - marked);

  const lowClasses = [...(attendance.classes ?? [])]
    .filter((c) => c.enrolled > 0)
    .map((c) => ({
      ...c,
      rate: c.marked > 0 ? Math.round((c.present / c.marked) * 100) : null,
    }))
    .sort((a, b) => {
      if (a.rate === null && b.rate === null) return b.enrolled - a.enrolled;
      if (a.rate === null) return -1;
      if (b.rate === null) return 1;
      return a.rate - b.rate;
    })
    .slice(0, 3);

  return (
    <PanelCard
      icon="percent"
      title="Attendance today"
      action={{ label: "Open", href: "/app/m/attendance" }}
      tone={unmarked > 0 && marked === 0 ? "warn" : "default"}
    >
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-[1.35rem] font-medium leading-none text-slate-900">
              {rate === null ? "—" : `${rate}%`}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {marked > 0
                ? `${attendance.present} present · ${attendance.absent} absent`
                : "Roll not taken yet"}
            </p>
          </div>
          <p className="text-right text-[10px] text-slate-500">
            <span className="block font-semibold tabular-nums text-slate-700">
              {marked}/{attendance.total_enrolled}
            </span>
            marked
          </p>
        </div>

        {unmarked > 0 ? (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
            {unmarked} learner{unmarked === 1 ? "" : "s"} still unmarked today
          </p>
        ) : null}

        {lowClasses.length > 0 ? (
          <ul className="space-y-1 border-t border-slate-100 pt-2">
            {lowClasses.map((c) => (
              <li key={c.class_id} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="truncate text-slate-600">{c.label}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {c.rate === null ? "Not marked" : `${c.rate}% present`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </PanelCard>
  );
}

function RegistrationProgressPanel({ data }: { data: StaffDashboardData }) {
  const { registration } = data;
  if (!registration || registration.total_students === 0) return null;

  const completePct = pct(registration.complete, registration.total_students) ?? 0;
  const pending = registration.not_started + registration.in_progress;

  return (
    <PanelCard
      icon="clipboard"
      title="Term check-in"
      action={{ label: "Queue", href: "/app/m/students/registration" }}
      tone={pending > 0 && completePct < 100 ? "warn" : "success"}
    >
      <div className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-[1.35rem] font-medium leading-none text-slate-900">
              {completePct}%
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {registration.complete} of {registration.total_students} complete
            </p>
          </div>
          <p className="text-[10px] text-slate-500">{registration.term_label}</p>
        </div>
        <ProgressBar pct={completePct} tone={completePct >= 90 ? "emerald" : "brand"} />
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <MiniCount label="Not started" value={registration.not_started} />
          <MiniCount label="In progress" value={registration.in_progress} warn />
          <MiniCount label="Complete" value={registration.complete} />
        </div>
      </div>
    </PanelCard>
  );
}

function FinanceSnapshotPanel({ data }: { data: StaffDashboardData }) {
  const { finance } = data;
  if (!finance) return null;

  const collectedPct =
    finance.total_invoiced_ugx > 0
      ? pct(finance.total_collected_ugx, finance.total_invoiced_ugx)
      : null;

  return (
    <PanelCard
      icon="wallet"
      title="Fee collection"
      action={{ label: "Finance", href: "/app/m/finance" }}
      tone={(finance.total_outstanding_ugx ?? 0) > 0 ? "warn" : "default"}
    >
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-[1.35rem] font-medium leading-none text-slate-900">
              {collectedPct === null ? "—" : `${collectedPct}%`}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {formatUGX(finance.total_collected_ugx)} collected
            </p>
          </div>
          <p className="text-right text-[10px] text-slate-500">
            <span className="block font-semibold tabular-nums text-slate-700">
              {formatUGX(finance.total_outstanding_ugx)}
            </span>
            outstanding
          </p>
        </div>
        {collectedPct !== null ? (
          <ProgressBar pct={collectedPct} tone={collectedPct >= 75 ? "emerald" : "gold"} />
        ) : null}
        <MetricRow
          label="Invoiced learners"
          value={`${finance.invoiced_count}/${finance.registered_count}`}
          hint={
            finance.not_invoiced_count > 0
              ? `${finance.not_invoiced_count} not invoiced`
              : undefined
          }
          warn={finance.not_invoiced_count > 0}
        />
      </div>
    </PanelCard>
  );
}

function AdmissionsPipelinePanel({ data }: { data: StaffDashboardData }) {
  const { pendingAdmissions } = data;
  if (pendingAdmissions.length === 0) return null;

  const byStatus = pendingAdmissions.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PanelCard
      icon="users"
      title="Admissions pipeline"
      action={{ label: "Review", href: "/app/m/admissions" }}
      tone="warn"
    >
      <div className="space-y-2">
        <p className="font-display text-[1.35rem] font-medium leading-none text-slate-900">
          {pendingAdmissions.length}
          <span className="ml-1.5 text-[11px] font-normal text-slate-500">active applications</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byStatus).map(([status, count]) => (
            <Badge key={status} tone="neutral">
              {status.replace("_", " ")} · {count}
            </Badge>
          ))}
        </div>
        <ul className="space-y-1 border-t border-slate-100 pt-2">
          {pendingAdmissions.slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                href="/app/m/admissions"
                className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[10.5px] hover:bg-slate-50"
              >
                <span className="truncate text-slate-700">
                  {a.first_name} {a.last_name}
                </span>
                <span className="shrink-0 capitalize text-slate-400">{a.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PanelCard>
  );
}

function AssessmentStatusPanel({ data }: { data: StaffDashboardData }) {
  const { assessment } = data;
  if (!assessment) return null;

  const needsAttention = assessment.open_sets > 0 || !assessment.ca_configured;

  return (
    <PanelCard
      icon="book"
      title="Assessment"
      action={{ label: "Open", href: "/app/m/assessment" }}
      tone={needsAttention ? "warn" : "default"}
    >
      <div className="space-y-1.5">
        <MetricRow label="Open for entry" value={String(assessment.open_sets)} warn={assessment.open_sets > 0} />
        <MetricRow label="Closed sets" value={String(assessment.closed_sets)} />
        <MetricRow label="Marks recorded" value={assessment.total_marks.toLocaleString()} />
        <MetricRow
          label="CA configured"
          value={assessment.ca_configured ? "Yes" : "Not yet"}
          warn={!assessment.ca_configured}
        />
      </div>
    </PanelCard>
  );
}

function HrAlertsPanel({ data }: { data: StaffDashboardData }) {
  const { hr } = data;
  if (!hr) return null;

  return (
    <PanelCard
      icon="users"
      title="Staff & leave"
      action={{ label: "HR", href: "/app/m/hr_payroll" }}
      tone={hr.pending_leave > 0 ? "warn" : "default"}
    >
      <div className="space-y-1.5">
        <MetricRow label="Active staff" value={String(hr.active_employees)} />
        <MetricRow
          label="Pending leave"
          value={String(hr.pending_leave)}
          warn={hr.pending_leave > 0}
        />
        <MetricRow label="On leave today" value={String(hr.on_leave_today)} />
        {hr.latest_payroll_label ? (
          <MetricRow
            label="Latest payroll"
            value={hr.latest_payroll_label}
            hint={hr.latest_payroll_net_ugx != null ? formatUGX(hr.latest_payroll_net_ugx) : undefined}
          />
        ) : null}
      </div>
    </PanelCard>
  );
}

function CircularsDraftPanel({ data }: { data: StaffDashboardData }) {
  const { circulars } = data;
  if (circulars.length === 0) return null;

  return (
    <PanelCard
      icon="chat"
      title="Circular drafts"
      action={{ label: "Manage", href: "/app/settings/circulars" }}
      tone="warn"
    >
      <ul className="space-y-1">
        {circulars.slice(0, 4).map((c) => (
          <li key={c.id}>
            <Link
              href="/app/settings/circulars"
              className="block truncate rounded-md px-1 py-0.5 text-[10.5px] text-slate-700 hover:bg-slate-50"
            >
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

function MiniCount({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
      <p
        className={`text-[13px] font-semibold tabular-nums ${warn && value > 0 ? "text-amber-700" : "text-slate-800"}`}
      >
        {value}
      </p>
      <p className="text-[9px] text-slate-500">{label}</p>
    </div>
  );
}

export function AdminDashboardPanels({ data }: { data: StaffDashboardData }) {
  const panels = [
    data.has("attendance") ? <AttendanceTodayPanel key="attendance" data={data} /> : null,
    data.has("students") ? <RegistrationProgressPanel key="registration" data={data} /> : null,
    data.canSeeFinance ? <FinanceSnapshotPanel key="finance" data={data} /> : null,
    data.canSeeAdmissions ? <AdmissionsPipelinePanel key="admissions" data={data} /> : null,
    data.has("assessment") ? <AssessmentStatusPanel key="assessment" data={data} /> : null,
    data.canSeeHrAdmin ? <HrAlertsPanel key="hr" data={data} /> : null,
    data.canSeeCircularsAdmin ? <CircularsDraftPanel key="circulars" data={data} /> : null,
  ].filter(Boolean);

  if (panels.length === 0) {
    return (
      <PanelCard icon="grid" title="Dashboard">
        <p className="text-[11px] text-slate-500">
          Subscribe to modules to see school insights here. Your sidebar lists everything you can
          access.
        </p>
      </PanelCard>
    );
  }

  return <div className="grid gap-3 sm:grid-cols-2">{panels}</div>;
}

export function TeacherSchedulePanel({ data }: { data: StaffDashboardData }) {
  const lessons = data.myDay?.lessons ?? [];
  const recorded = lessons.filter((l) => l.recorded).length;
  const open = lessons.filter((l) => l.can_record && !l.recorded).length;

  return (
    <PanelCard
      icon="calendar"
      title="Today's lessons"
      action={{ label: "Attendance", href: "/app/m/attendance" }}
      tone={open > 0 ? "warn" : recorded > 0 ? "success" : "default"}
    >
      {lessons.length === 0 ? (
        <p className="text-[11px] text-slate-500">No lessons on your timetable today.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">
            {recorded}/{lessons.length} attendance rolls recorded
            {open > 0 ? ` · ${open} ready to mark` : ""}
          </p>
          <ul className="space-y-1">
            {lessons.map((l) => {
              const status = l.recorded
                ? "Recorded"
                : l.can_record
                  ? "Mark now"
                  : l.has_ended
                    ? "Missed"
                    : "Upcoming";
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-slate-800">
                      {l.subject_name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {classLabel(l)}
                      {l.stream_name ? ` · ${l.stream_name}` : ""} · {fmtTime(l.starts_at)}–
                      {fmtTime(l.ends_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      l.recorded
                        ? "bg-emerald-50 text-emerald-700"
                        : l.can_record
                          ? "bg-brand-50 text-brand-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PanelCard>
  );
}

export function TeacherLoadPanel({ data }: { data: StaffDashboardData }) {
  const { assignments } = data;
  if (assignments.length === 0) return null;

  const classIds = new Set(assignments.map((a) => a.class_id));
  const subjectIds = new Set(assignments.map((a) => a.subject_id));
  const classTeacher = assignments.filter((a) => a.is_class_teacher);

  return (
    <PanelCard
      icon="graduation"
      title="Teaching load"
      action={{ label: "Timetable", href: "/app/m/timetable" }}
    >
      <div className="space-y-1.5">
        <MetricRow label="Classes" value={String(classIds.size)} />
        <MetricRow label="Subjects" value={String(subjectIds.size)} />
        <MetricRow
          label="Class teacher"
          value={
            classTeacher.length > 0
              ? classTeacher.map((a) => a.class_level).join(", ")
              : "None assigned"
          }
        />
      </div>
    </PanelCard>
  );
}

export function TeacherDashboardPanels({ data }: { data: StaffDashboardData }) {
  const panels = [
    data.has("teachers") ? <TeacherLoadPanel key="load" data={data} /> : null,
    data.has("assessment") ? <AssessmentStatusPanel key="assessment" data={data} /> : null,
    data.has("attendance") && !data.has("timetable") ? (
      <AttendanceTodayPanel key="attendance" data={data} />
    ) : null,
  ].filter(Boolean);

  if (panels.length === 0) {
    return (
      <PanelCard icon="grid" title="Your dashboard">
        <p className="text-[11px] text-slate-500">
          Timetable and assessment modules unlock daily teaching insights here.
        </p>
      </PanelCard>
    );
  }

  return <div className="grid gap-3 sm:grid-cols-2">{panels}</div>;
}
