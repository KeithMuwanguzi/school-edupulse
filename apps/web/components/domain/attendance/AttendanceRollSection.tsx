"use client";

import { useEffect, useMemo, useState } from "react";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import type { AttendanceRollOut, AttendanceStatus, RosterScope } from "@/lib/types";
import { parseError } from "@/lib/apiError";
import {
  useAttendanceRollQuery,
  useAttendanceSummaryQuery,
  useMarkAttendanceMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { AttendanceClassNav } from "./AttendanceClassNav";
import { AttendanceRollList, type LocalRollRow } from "./AttendanceRollList";
import {
  attendanceScopeLabel,
  defaultAttendanceScope,
  scopeToRollParams,
  todayIso,
} from "./attendanceScope";

interface AttendanceRollSectionProps {
  canMark: boolean;
}

function rowsFromRoll(roll: AttendanceRollOut | undefined): LocalRollRow[] {
  if (!roll) return [];
  return roll.rows.map((r) => ({
    student_id: r.student_id,
    student_number: r.student_number,
    first_name: r.first_name,
    last_name: r.last_name,
    status: r.status,
    remarks: r.remarks ?? "",
    term_rate: r.term_rate,
  }));
}

function countByStatus(rows: LocalRollRow[]) {
  return rows.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 },
  );
}

export function AttendanceRollSection({ canMark }: AttendanceRollSectionProps) {
  const { toast } = useToast();
  const [date, setDate] = useState(todayIso);
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [localRows, setLocalRows] = useState<LocalRollRow[]>([]);
  const [baseline, setBaseline] = useState("");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: fetchingSummary } =
    useAttendanceSummaryQuery({ date });
  const rollParams = scope && scope.kind === "class" ? scopeToRollParams(scope, date) : null;
  const { data: roll, isLoading: rollLoading, isFetching, refetch: refetchRoll } = useAttendanceRollQuery(
    rollParams!,
    { skip: !rollParams },
  );
  const [markAttendance, { isLoading: saving }] = useMarkAttendanceMutation();

  useEffect(() => {
    if (scope === null && summary) {
      setScope(defaultAttendanceScope(summary));
    }
  }, [summary, scope]);

  useEffect(() => {
    if (!roll) return;
    const next = rowsFromRoll(roll);
    setLocalRows(next);
    setBaseline(JSON.stringify(next));
  }, [roll]);

  const dirty = baseline !== "" && JSON.stringify(localRows) !== baseline;
  const localCounts = useMemo(() => countByStatus(localRows), [localRows]);
  const rosterTitle = scope ? attendanceScopeLabel(scope, summary) : "Roll call";

  function setStatus(studentId: string, status: AttendanceStatus) {
    setLocalRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)),
    );
  }

  function setRemarks(studentId: string, remarks: string) {
    setLocalRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, remarks } : r)),
    );
  }

  function markAllPresent() {
    setLocalRows((prev) => prev.map((r) => ({ ...r, status: "present" as const })));
  }

  async function saveRoll() {
    if (!rollParams || !localRows.length) return;
    try {
      const res = await markAttendance({
        class_id: rollParams.classId,
        stream_id: rollParams.streamId,
        date,
        records: localRows.map((r) => ({
          student_id: r.student_id,
          status: r.status,
          remarks: r.remarks.trim() || undefined,
        })),
      }).unwrap();
      toast(`Roll saved — ${res.saved} students marked.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const isToday = date === todayIso();
  const isRefreshing = fetchingSummary || isFetching;

  async function refreshAll() {
    await refreshQueries(refetchSummary, refetchRoll);
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {summary && summary.total_enrolled > 0 ? (
          <SettingsStatRow
            items={[
              {
                label: "Period",
                value: summary.term_label
                  ? `${summary.academic_year_label} · ${summary.term_label}`
                  : summary.academic_year_label,
              },
              { label: "Present", value: summary.present },
              { label: "Absent", value: summary.absent },
              { label: "Late", value: summary.late },
              ...(summary.chronic_absentees > 0
                ? [{ label: "Chronic", value: summary.chronic_absentees }]
                : []),
            ]}
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon
              name="calendar"
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 pl-8"
              aria-label="Attendance date"
            />
          </div>
          <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh attendance" />
        </div>
      </div>

      {summaryLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading…</Card>
      ) : !summary || summary.total_enrolled === 0 ? (
        <EmptyState
          icon={<Icon name="check" size={18} />}
          title="Nothing to mark yet"
          description="Enroll students into classes before taking the daily roll call."
        />
      ) : scope ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full shrink-0 lg:w-48">
            <Card className="p-1.5 lg:sticky lg:top-2">
              <AttendanceClassNav summary={summary} scope={scope} onChange={setScope} />
            </Card>
          </div>

          <div className="min-w-0 flex-1">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                    {rosterTitle}
                  </h3>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                    <Tally tone="text-brand-600" label="P" value={localCounts.present} />
                    <Tally tone="text-red-500" label="A" value={localCounts.absent} />
                    <Tally tone="text-gold-600" label="L" value={localCounts.late} />
                    <Tally tone="text-blue-500" label="E" value={localCounts.excused} />
                  </span>
                </div>
                {canMark && isToday && localRows.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={markAllPresent}>
                    Mark all present
                  </Button>
                )}
              </div>

              <div className="px-1.5 py-1">
                {rollLoading || isFetching ? (
                  <p className="py-6 text-center text-[12px] text-slate-400">Loading roster…</p>
                ) : (
                  <AttendanceRollList
                    rows={localRows}
                    canEdit={canMark && isToday}
                    onStatusChange={setStatus}
                    onRemarksChange={setRemarks}
                  />
                )}
              </div>

              {canMark && isToday && dirty && localRows.length > 0 && (
                <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-b-xl border-t border-brand-100 bg-brand-50/70 px-4 py-2.5 backdrop-blur-sm">
                  <span className="text-[11px] font-medium text-brand-800">
                    {localRows.length} students · unsaved changes
                  </span>
                  <Button size="sm" loading={saving} onClick={() => void saveRoll()}>
                    Save roll
                  </Button>
                </div>
              )}
            </Card>

            {!isToday && (
              <p className="mt-2 text-[10px] text-slate-400">
                Viewing {date} — switch to today to edit.
              </p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes yet"
          description="Set up classes under the Academic year settings to take roll call."
        />
      )}
    </div>
  );
}

function Tally({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <span className="tabular-nums">
      <span className={`font-semibold ${tone}`}>{label}</span> {value}
    </span>
  );
}
