"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { cn } from "@/lib/cn";
import { useAppSelector } from "@/store/hooks";
import { useGetStudentDetailQuery } from "@/store/api/skulpulseApi";
import { StudentInfoPanel } from "./StudentInfoPanel";
import { StudentGuardiansPanel } from "./StudentGuardiansPanel";
import { StudentHealthPanel } from "./StudentHealthPanel";
import { StudentDisciplinePanel } from "./StudentDisciplinePanel";
import { StudentPerformanceView } from "./StudentPerformanceView";
import { formatStudentFullName, titleCase } from "./studentOptions";

type TabKey = "information" | "guardians" | "health" | "discipline" | "performance";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "information", label: "Profile", icon: "user" },
  { key: "guardians", label: "Guardians", icon: "users" },
  { key: "health", label: "Health", icon: "heart" },
  { key: "discipline", label: "Discipline", icon: "shield" },
  { key: "performance", label: "Performance", icon: "chart" },
];

function statusTone(status: string): string {
  switch (status) {
    case "enrolled":
      return "bg-brand-50 text-brand-700 ring-brand-200";
    case "graduated":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "suspended":
    case "withdrawn":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gold-50 text-gold-700 ring-gold-200";
  }
}

export function StudentDetailView({ studentId }: { studentId: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "school_admin";
  const [tab, setTab] = useState<TabKey>("information");
  const { data: student, isLoading, isError, refetch, isFetching } = useGetStudentDetailQuery(studentId);

  if (isLoading) return <PageLoader />;
  if (isError || !student) {
    return <ErrorBanner message="Could not load this student." />;
  }

  const fullName = formatStudentFullName(student);
  const initials = `${student.last_name.slice(0, 1)}${student.first_name.slice(0, 1)}`.toUpperCase();
  const placement = student.class_level
    ? student.stream_name
      ? `${student.class_level} · ${student.stream_name}`
      : student.class_level
    : "Unassigned";

  return (
    <div className="space-y-4 animate-fade-rise">
      <Link
        href="/app/m/students"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
      >
        <Icon name="chevron-left" size={13} />
        Back to roster
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-brand-600/5 via-white to-slate-50/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-[18px] font-semibold text-white shadow-md shadow-brand-700/20">
                {initials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[20px] font-semibold tracking-tight text-slate-900">
                    {fullName}
                  </h1>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1",
                      statusTone(student.status),
                    )}
                  >
                    {titleCase(student.status)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  <span className="font-mono text-slate-400">{student.student_number}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {placement}
                  {student.gender && (
                    <>
                      <span className="mx-1.5 text-slate-300">·</span>
                      {titleCase(student.gender)}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh student" />
              <div className="flex gap-5 text-center">
                <div>
                  <p className="text-[16px] font-semibold tabular-nums text-slate-800">
                    {student.guardians.length}
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Guardians</p>
                </div>
                <div>
                  <p className="text-[16px] font-semibold tabular-nums text-slate-800">
                    {student.discipline.length}
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Incidents</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === "guardians"
                ? student.guardians.length
                : t.key === "discipline"
                  ? student.discipline.length
                  : null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <Icon name={t.icon} size={12} />
                {t.label}
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[9px] tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        {tab === "information" && <StudentInfoPanel student={student} isAdmin={!!isAdmin} />}
        {tab === "guardians" && (
          <StudentGuardiansPanel studentId={studentId} guardians={student.guardians} isAdmin={!!isAdmin} />
        )}
        {tab === "health" && (
          <StudentHealthPanel studentId={studentId} health={student.health} isAdmin={!!isAdmin} />
        )}
        {tab === "discipline" && (
          <StudentDisciplinePanel studentId={studentId} records={student.discipline} isAdmin={!!isAdmin} />
        )}
        {tab === "performance" && <StudentPerformanceView studentId={studentId} />}
      </Card>
    </div>
  );
}
