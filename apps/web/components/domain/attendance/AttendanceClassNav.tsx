"use client";

import { cn } from "@/lib/cn";
import type { AttendanceDailySummary, RosterScope } from "@/lib/types";

interface AttendanceClassNavProps {
  summary: AttendanceDailySummary;
  scope: RosterScope;
  onChange: (scope: RosterScope) => void;
}

function NavButton({
  active,
  label,
  meta,
  indent,
  onClick,
}: {
  active: boolean;
  label: string;
  meta?: string;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] transition",
        indent && "pl-4",
        active
          ? "bg-slate-100 font-medium text-brand-700"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {meta && <span className="ml-auto tabular-nums text-[10px] text-slate-300">{meta}</span>}
    </button>
  );
}

export function AttendanceClassNav({ summary, scope, onChange }: AttendanceClassNavProps) {
  return (
    <nav className="space-y-0.5" aria-label="Class attendance navigator">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
        Classes
      </p>
      {summary.classes.map((cls) => {
        const classActive = scope.kind === "class" && scope.classId === cls.class_id;
        const meta =
          cls.enrolled === 0
            ? "—"
            : cls.marked === 0
              ? `${cls.enrolled}`
              : `${cls.marked}/${cls.enrolled}`;
        return (
          <NavButton
            key={cls.class_id}
            active={classActive}
            label={cls.label ? `${cls.level} · ${cls.label}` : cls.level}
            meta={meta}
            onClick={() => onChange({ kind: "class", classId: cls.class_id })}
          />
        );
      })}
      {summary.total_enrolled > 0 && summary.total_marked < summary.total_enrolled && (
        <p className="px-2 pt-1 text-[10px] text-slate-400">
          {summary.total_enrolled - summary.total_marked} not marked school-wide
        </p>
      )}
    </nav>
  );
}
