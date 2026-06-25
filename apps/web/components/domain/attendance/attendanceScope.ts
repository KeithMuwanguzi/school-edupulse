import type { AttendanceDailySummary, RosterScope } from "@/lib/types";
import { localTodayIso } from "@/lib/localDate";

export function todayIso(): string {
  return localTodayIso();
}

export function defaultAttendanceScope(summary: AttendanceDailySummary | undefined): RosterScope | null {
  if (!summary || summary.classes.length === 0) return null;
  const withStudents = summary.classes.find((c) => c.enrolled > 0);
  if (withStudents) return { kind: "class", classId: withStudents.class_id };
  return { kind: "class", classId: summary.classes[0].class_id };
}

export function attendanceScopeLabel(
  scope: RosterScope,
  summary: AttendanceDailySummary | undefined,
): string {
  if (scope.kind === "overview") return "Overview";
  if (scope.kind === "unassigned") return "Unassigned";
  const cls = summary?.classes.find((c) => c.class_id === scope.classId);
  if (!cls) return "Class";
  if (scope.kind === "stream") {
    return `${cls.level} · stream`;
  }
  return cls.label ? `${cls.level} (${cls.label})` : cls.level;
}

export function scopeToRollParams(scope: RosterScope, date: string) {
  if (scope.kind === "stream") {
    return { classId: scope.classId, streamId: scope.streamId, date };
  }
  if (scope.kind === "class") {
    return { classId: scope.classId, date };
  }
  return null;
}
