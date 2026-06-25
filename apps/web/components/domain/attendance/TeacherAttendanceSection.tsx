"use client";

import { useEffect, useMemo, useState } from "react";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import type { AttendanceRollOut, AttendanceStatus, TeacherLessonOut } from "@/lib/types";
import {
  useAttendanceRollQuery,
  useMarkAttendanceMutation,
  useTimetableMyDayQuery,
} from "@/store/api/skulpulseApi";
import { AttendanceRollList, type LocalRollRow } from "./AttendanceRollList";
import { todayIso } from "./attendanceScope";
import { classLabel, fmtTime } from "../timetable/timetableUtils";

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

function lessonStatus(l: TeacherLessonOut): { label: string; tone: string } {
  if (l.recorded) return { label: "Recorded", tone: "bg-emerald-100 text-emerald-800" };
  if (l.can_record) return { label: "Open", tone: "bg-brand-100 text-brand-700" };
  if (l.is_today && !l.has_ended)
    return { label: `Opens ${fmtTime(l.ends_at)}`, tone: "bg-slate-100 text-slate-500" };
  return { label: "Closed", tone: "bg-slate-100 text-slate-400" };
}

export function TeacherAttendanceSection() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayIso);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localRows, setLocalRows] = useState<LocalRollRow[]>([]);
  const [baseline, setBaseline] = useState("");

  const { data: day, isLoading, error, refetch: refetchDay, isFetching: fetchingDay } =
    useTimetableMyDayQuery({ date });
  const lessons = useMemo(() => day?.lessons ?? [], [day]);

  const selected = useMemo(
    () => lessons.find((l) => l.id === selectedId) ?? null,
    [lessons, selectedId],
  );

  // Auto-select the first lesson that can be recorded, else the first lesson.
  useEffect(() => {
    if (lessons.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && lessons.some((l) => l.id === cur)) return cur;
      const openable = lessons.find((l) => l.can_record);
      return (openable ?? lessons[0]).id;
    });
  }, [lessons]);

  const rollParams = selected
    ? {
        classId: selected.class_id,
        streamId: selected.stream_id ?? undefined,
        date,
        timetableSlotId: selected.id,
      }
    : null;
  const { data: roll, isFetching, refetch: refetchRoll } = useAttendanceRollQuery(rollParams!, {
    skip: !rollParams,
  });
  const [markAttendance, { isLoading: saving }] = useMarkAttendanceMutation();

  useEffect(() => {
    setLocalRows([]);
    setBaseline("");
  }, [selectedId]);

  useEffect(() => {
    if (!roll) return;
    const next = rowsFromRoll(roll);
    setLocalRows(next);
    setBaseline(JSON.stringify(next));
  }, [roll]);

  const canEdit = !!selected?.can_record;
  const dirty = baseline !== "" && JSON.stringify(localRows) !== baseline;

  function setStatus(studentId: string, status: AttendanceStatus) {
    setLocalRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)));
  }
  function setRemarks(studentId: string, remarks: string) {
    setLocalRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, remarks } : r)));
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
        timetable_slot_id: rollParams.timetableSlotId,
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

  const isRefreshing = fetchingDay || isFetching;

  async function refreshAll() {
    await refreshQueries(refetchDay, refetchRoll);
  }

  if (error) {
    const p = parseError(error);
    const notSubscribed = p.code === "MODULE_NOT_SUBSCRIBED";
    return (
      <EmptyState
        icon={<Icon name="calendar" size={18} />}
        title={notSubscribed ? "Timetable not enabled" : "Couldn't load your timetable"}
        description={
          notSubscribed
            ? "Attendance is taken from your timetable. Ask your school to enable the Timetable module."
            : p.message
        }
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SettingsStatRow
          items={[
            {
              label: "Period",
              value: day
                ? day.term_label
                  ? `${day.academic_year_label} · ${day.term_label}`
                  : day.academic_year_label
                : "—",
            },
            { label: "Lessons", value: lessons.length },
            { label: "Recorded", value: lessons.filter((l) => l.recorded).length },
          ]}
        />
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
              aria-label="Day"
            />
          </div>
          <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh lessons" />
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading your day…</Card>
      ) : lessons.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" size={18} />}
          title="No lessons scheduled"
          description="You have no timetabled lessons on this day, so there is nothing to record."
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Lesson list */}
          <div className="w-full shrink-0 lg:w-72">
            <Card className="divide-y divide-slate-100 lg:sticky lg:top-2">
              {lessons.map((l) => {
                const st = lessonStatus(l);
                const active = l.id === selectedId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left transition",
                      active ? "bg-brand-50/70" : "hover:bg-slate-50",
                    )}
                  >
                    <div className="w-20 shrink-0 tabular-nums text-[11px] font-medium text-slate-600">
                      {fmtTime(l.starts_at)}
                      <span className="block text-[10px] text-slate-400">{fmtTime(l.ends_at)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-slate-900">
                        {l.subject_code}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{classLabel(l)}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold",
                        st.tone,
                      )}
                    >
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </Card>
          </div>

          {/* Selected lesson roll */}
          <div className="min-w-0 flex-1">
            {selected ? (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-[12px] font-semibold tracking-tight text-slate-900">
                      {selected.subject_name} · {classLabel(selected)}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {fmtTime(selected.starts_at)}–{fmtTime(selected.ends_at)}
                      {selected.room ? ` · ${selected.room}` : ""} · {selected.enrolled} enrolled
                    </p>
                  </div>
                  {canEdit && localRows.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={markAllPresent}>
                      Mark all present
                    </Button>
                  )}
                </div>

                {!canEdit && (
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
                    <Icon name="clock" size={13} className="shrink-0 text-slate-400" />
                    {selected.recorded
                      ? "Attendance has been recorded for this lesson."
                      : selected.is_today && !selected.has_ended
                        ? `You can record attendance once the lesson ends at ${fmtTime(selected.ends_at)}.`
                        : "Attendance can only be recorded on the lesson day, after it ends."}
                  </div>
                )}

                <div className="px-1.5 py-1">
                  {isFetching ? (
                    <p className="py-6 text-center text-[12px] text-slate-400">Loading roster…</p>
                  ) : (
                    <AttendanceRollList
                      rows={localRows}
                      canEdit={canEdit}
                      onStatusChange={setStatus}
                      onRemarksChange={setRemarks}
                    />
                  )}
                </div>

                {canEdit && dirty && localRows.length > 0 && (
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
            ) : (
              <Card className="p-8 text-center text-[12px] text-slate-400">
                Select a lesson to view its roll.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
