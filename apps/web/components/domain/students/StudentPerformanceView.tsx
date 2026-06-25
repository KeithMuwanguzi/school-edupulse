"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useAppSelector } from "@/store/hooks";
import { useStudentPerformanceQuery } from "@/store/api/skulpulseApi";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function StudentPerformanceView({ studentId }: { studentId?: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("assessment") ?? false;

  const { data, isLoading, isError } = useStudentPerformanceQuery(
    { studentId: studentId ?? "" },
    { skip: !studentId || !subscribed },
  );

  if (!user) return <PageLoader />;
  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="chart" size={18} />}
        title="Assessment module not enabled"
        description="Contact SkulPulse to add the Assessment module to see exam results and grade trends here."
      />
    );
  }
  if (!studentId) {
    return (
      <EmptyState
        icon={<Icon name="chart" size={18} />}
        title="Select a pupil"
        description="Open a pupil to view their per-term results, grades, aggregate and division."
      />
    );
  }
  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={<Icon name="chart" size={18} />}
        title="No performance yet"
        description="This pupil has no recorded marks for the current term."
      />
    );
  }

  if (!data.marks_available) {
    return (
      <EmptyState
        icon={<Icon name="chart" size={18} />}
        title="No marks recorded"
        description={`No marks have been entered for ${data.term_label} yet.`}
      />
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Performance — ${data.term_label}`}
        description={`${data.class_label ?? data.class_level} · continuous assessment by subject and set.`}
      />
      <CardBody className="space-y-4 py-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Average" value={data.average_score != null ? `${data.average_score}%` : "—"} />
          <Stat label="Aggregate" value={data.aggregate != null ? String(data.aggregate) : "—"} />
          <Stat label="Division" value={data.division_label ?? "—"} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                {data.set_columns.map((col) => (
                  <TH key={col.set_id}>
                    {col.set_name}
                    <span className="text-slate-400"> /{col.max_mark}</span>
                  </TH>
                ))}
                <TH>CA %</TH>
                <TH>Grade</TH>
                <TH>Pts</TH>
              </TR>
            </THead>
            <TBody>
              {data.subjects.map((subject) => {
                const byId = new Map(subject.set_marks.map((m) => [m.set_id, m]));
                return (
                  <TR key={subject.subject_id}>
                    <TD>
                      {subject.subject_name}
                      {subject.is_core ? <span className="text-slate-400"> *</span> : ""}
                    </TD>
                    {data.set_columns.map((col) => {
                      const mark = byId.get(col.set_id);
                      return (
                        <TD key={col.set_id}>
                          {mark && mark.score != null ? mark.score : "—"}
                        </TD>
                      );
                    })}
                    <TD>{subject.ca_score != null ? subject.ca_score : "—"}</TD>
                    <TD>{subject.grade_label ?? "—"}</TD>
                    <TD>{subject.aggregate_points ?? "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <p className="mt-2 text-[11px] text-slate-400">* core subjects counted toward the aggregate.</p>
        </div>
      </CardBody>
    </Card>
  );
}
