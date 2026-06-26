"use client";

import { Select } from "@/components/ui/Select";
import type { AttendanceDailySummary, RosterScope } from "@/lib/types";
import { AttendanceClassNav } from "./AttendanceClassNav";

interface AttendanceClassPickerProps {
  summary: AttendanceDailySummary;
  scope: RosterScope;
  onChange: (scope: RosterScope) => void;
}

function scopeToValue(scope: RosterScope): string {
  if (scope.kind === "class") return scope.classId;
  if (scope.kind === "stream") return `${scope.classId}:${scope.streamId}`;
  return "";
}

/** Mobile: native select. Desktop (lg+): sidebar class nav. */
export function AttendanceClassPicker({ summary, scope, onChange }: AttendanceClassPickerProps) {
  const value = scopeToValue(scope);

  return (
    <>
      <div className="lg:hidden">
        <Select
          value={value}
          onChange={(e) => {
            const id = e.target.value;
            if (id) onChange({ kind: "class", classId: id });
          }}
          className="w-full text-[12px]"
          aria-label="Class"
        >
          <option value="">Choose class…</option>
          {summary.classes.map((cls) => {
            const meta =
              cls.enrolled === 0
                ? ""
                : cls.marked === 0
                  ? ` (${cls.enrolled})`
                  : ` (${cls.marked}/${cls.enrolled})`;
            return (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.label ? `${cls.level} · ${cls.label}` : cls.level}
                {meta}
              </option>
            );
          })}
        </Select>
      </div>
      <div className="hidden lg:block">
        <AttendanceClassNav summary={summary} scope={scope} onChange={onChange} />
      </div>
    </>
  );
}
