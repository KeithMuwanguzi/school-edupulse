"use client";

import { ClassStreamNavigator } from "./ClassStreamNavigator";
import { Select } from "@/components/ui/Select";
import type { RosterScope, RosterSummaryOut } from "@/lib/types";
import { scopeLabel } from "./rosterScope";

interface ClassStreamPickerProps {
  summary: RosterSummaryOut;
  scope: RosterScope;
  onChange: (scope: RosterScope) => void;
  registrationMode?: boolean;
  teacherMode?: boolean;
}

function scopeOptions(
  summary: RosterSummaryOut,
  registrationMode: boolean,
  teacherMode: boolean,
): { value: string; label: string; scope: RosterScope }[] {
  const options: { value: string; label: string; scope: RosterScope }[] = [];

  if (!registrationMode && !teacherMode) {
    options.push({ value: "overview", label: "Overview", scope: { kind: "overview" } });
  }
  if (!teacherMode) {
    options.push({
      value: "unassigned",
      label: `Unassigned (${summary.unassigned})`,
      scope: { kind: "unassigned" },
    });
  }

  for (const cls of summary.classes) {
    if (cls.streams.length === 0) {
      options.push({
        value: `class:${cls.class_id}`,
        label: `${cls.label ? `${cls.level} · ${cls.label}` : cls.level} (${cls.count})`,
        scope: { kind: "class", classId: cls.class_id },
      });
    } else {
      for (const stream of cls.streams) {
        options.push({
          value: `stream:${cls.class_id}:${stream.stream_id}`,
          label: `${cls.level} · ${stream.name} (${stream.count})`,
          scope: {
            kind: "stream",
            classId: cls.class_id,
            streamId: stream.stream_id,
          },
        });
      }
      if (!registrationMode) {
        options.push({
          value: `class:${cls.class_id}`,
          label: `${cls.label ? `${cls.level} · ${cls.label}` : cls.level} — all streams (${cls.count})`,
          scope: { kind: "class", classId: cls.class_id },
        });
      }
    }
  }

  return options;
}

function scopeToValue(scope: RosterScope): string {
  if (scope.kind === "overview") return "overview";
  if (scope.kind === "unassigned") return "unassigned";
  if (scope.kind === "stream") return `stream:${scope.classId}:${scope.streamId}`;
  return `class:${scope.classId}`;
}

/** Mobile: native select. Desktop (lg+): sidebar navigator. */
export function ClassStreamPicker({
  summary,
  scope,
  onChange,
  registrationMode = false,
  teacherMode = false,
}: ClassStreamPickerProps) {
  const options = scopeOptions(summary, registrationMode, teacherMode);

  return (
    <>
      <div className="lg:hidden">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {registrationMode ? "Class / stream" : "Roster"}
        </label>
        <Select
          value={scopeToValue(scope)}
          onChange={(e) => {
            const hit = options.find((o) => o.value === e.target.value);
            if (hit) onChange(hit.scope);
          }}
          className="h-9 w-full text-[13px]"
          aria-label="Choose class or stream"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        {scope.kind !== "overview" && (
          <p className="mt-1 text-[10px] text-slate-400">{scopeLabel(scope, summary)}</p>
        )}
      </div>

      <div className="hidden lg:block">
        <ClassStreamNavigator
          summary={summary}
          scope={scope}
          onChange={onChange}
          registrationMode={registrationMode}
          teacherMode={teacherMode}
        />
      </div>
    </>
  );
}
