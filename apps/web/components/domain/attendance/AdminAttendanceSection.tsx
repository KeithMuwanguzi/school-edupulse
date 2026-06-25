"use client";

import { useEffect, useMemo, useState } from "react";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import type { AttendanceRollOut, RosterScope } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  useAttendanceClassDayQuery,
  useAttendanceRollQuery,
  useAttendanceSummaryQuery,
} from "@/store/api/skulpulseApi";
import { AttendanceClassNav } from "./AttendanceClassNav";
import { AttendanceRollList, type LocalRollRow } from "./AttendanceRollList";
import {
  attendanceScopeLabel,
  defaultAttendanceScope,
  todayIso,
} from "./attendanceScope";
import { fmtTime } from "../timetable/timetableUtils";

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

export function AdminAttendanceSection() {
  const [date, setDate] = useState(todayIso);
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary, isFetching: fetchingSummary } =
    useAttendanceSummaryQuery({ date });

  useEffect(() => {
    if (scope === null && summary) {
      setScope(defaultAttendanceScope(summary));
    }
  }, [summary, scope]);

  const classParams =
    scope && (scope.kind === "class" || scope.kind === "stream")
      ? {
          classId: scope.classId,
          streamId: scope.kind === "stream" ? scope.streamId : undefined,
          date,
        }
      : null;

  const {
    data: classDay,
    isLoading: dayLoading,
    isError: dayError,
    refetch: refetchDay,
    isFetching: fetchingDay,
  } = useAttendanceClassDayQuery(classParams!, { skip: !classParams });

  const lessons = useMemo(() => classDay?.lessons ?? [], [classDay]);

  useEffect(() => {
    if (!lessons.length) {
      setSelectedSlotId(null);
      return;
    }
    setSelectedSlotId((cur) => {
      if (cur && lessons.some((l) => l.slot_id === cur)) return cur;
      return lessons[0].slot_id;
    });
  }, [lessons]);

  const rollParams =
    classParams && selectedSlotId
      ? { ...classParams, timetableSlotId: selectedSlotId }
      : null;

  const { data: roll, isLoading: rollLoading, isError: rollError, refetch: refetchRoll, isFetching: fetchingRoll } =
    useAttendanceRollQuery(rollParams!, { skip: !rollParams });

  const localRows = rowsFromRoll(roll);
  const rosterTitle = scope ? attendanceScopeLabel(scope, summary) : "Attendance";

  async function refreshAll() {
    await refreshQueries(refetchSummary, refetchDay, refetchRoll);
  }

  return (
    <div className="space-y-4 animate-fade-rise">
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
          <RefreshButton
            onRefresh={refreshAll}
            isRefreshing={fetchingSummary || fetchingDay || fetchingRoll}
            label="Refresh attendance"
          />
        </div>
      </div>

      {summaryLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading…</Card>
      ) : summaryError || dayError || rollError ? (
        <ErrorBanner message="Couldn't load attendance. Please refresh and try again." />
      ) : !summary || summary.total_enrolled === 0 ? (
        <EmptyState
          icon={<Icon name="check" size={18} />}
          title="Nothing to view yet"
          description="Enroll students into classes before reviewing attendance."
        />
      ) : scope ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full shrink-0 lg:w-48">
            <Card className="p-1.5 lg:sticky lg:top-2">
              <AttendanceClassNav summary={summary} scope={scope} onChange={setScope} />
            </Card>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {dayLoading ? (
              <PageLoader />
            ) : lessons.length === 0 ? (
              <EmptyState
                icon={<Icon name="calendar" size={18} />}
                title="No timetable for this day"
                description={`No lessons are scheduled for ${rosterTitle} on this weekday. Set up the timetable under Timetable, or pick another date.`}
              />
            ) : (
              <>
                <Card className="divide-y divide-slate-100">
                  {lessons.map((lesson) => {
                    const active = lesson.slot_id === selectedSlotId;
                    return (
                      <button
                        key={lesson.slot_id}
                        type="button"
                        onClick={() => setSelectedSlotId(lesson.slot_id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                          active ? "bg-brand-50/70" : "hover:bg-slate-50",
                        )}
                      >
                        <div className="w-20 shrink-0 tabular-nums text-[11px] font-medium text-slate-600">
                          {fmtTime(lesson.starts_at)}
                          <span className="block text-[10px] text-slate-400">
                            {fmtTime(lesson.ends_at)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-slate-900">
                            {lesson.subject_code} · {lesson.subject_name}
                          </p>
                          <p className="text-[11px] text-slate-500">{lesson.teacher_name}</p>
                        </div>
                        <div className="shrink-0 text-right text-[10px] tabular-nums text-slate-500">
                          {lesson.recorded ? (
                            <>
                              <span className="font-semibold text-brand-700">P {lesson.present}</span>
                              {" · "}
                              <span className="text-red-600">A {lesson.absent}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">Not recorded</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </Card>

                <Card>
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                      Period roll — {rosterTitle}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      View-only. Teachers record attendance from their timetable lessons.
                    </p>
                  </div>
                  <div className="px-1.5 py-1">
                    {rollLoading || fetchingRoll ? (
                      <p className="py-6 text-center text-[12px] text-slate-400">Loading roll…</p>
                    ) : (
                      <AttendanceRollList
                        rows={localRows}
                        canEdit={false}
                        onStatusChange={() => {}}
                        onRemarksChange={() => {}}
                      />
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
