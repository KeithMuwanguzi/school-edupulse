"use client";

import { cn } from "@/lib/cn";
import type { RosterScope, RosterSummaryOut } from "@/lib/types";

interface ClassStreamNavigatorProps {
  summary: RosterSummaryOut;
  scope: RosterScope;
  onChange: (scope: RosterScope) => void;
  /** Registration queue: no school-wide overview; streamed classes list streams only. */
  registrationMode?: boolean;
  /** Teachers only see assigned classes — hide overview and unassigned. */
  teacherMode?: boolean;
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto tabular-nums text-[10px] text-slate-300">{count}</span>
  );
}

function NavButton({
  active,
  label,
  count,
  indent,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
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
      {count !== undefined && <CountBadge count={count} />}
    </button>
  );
}

export function ClassStreamNavigator({
  summary,
  scope,
  onChange,
  registrationMode = false,
  teacherMode = false,
}: ClassStreamNavigatorProps) {
  const unassignedActive = scope.kind === "unassigned";
  const overviewActive = scope.kind === "overview";

  return (
    <nav className="space-y-0.5" aria-label="Class and stream roster">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
        {registrationMode ? "Class / stream" : "Roster"}
      </p>
      {!registrationMode && !teacherMode && (
        <NavButton
          active={overviewActive}
          label="Overview"
          count={summary.total}
          onClick={() => onChange({ kind: "overview" })}
        />
      )}
      {!teacherMode && (
        <NavButton
          active={unassignedActive}
          label="Unassigned"
          count={summary.unassigned}
          onClick={() => onChange({ kind: "unassigned" })}
        />
      )}
      {summary.classes.map((cls) => {
        const hasStreams = cls.streams.length > 0;
        const classActive =
          !hasStreams && scope.kind === "class" && scope.classId === cls.class_id;
        return (
          <div key={cls.class_id}>
            {hasStreams && registrationMode ? (
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {cls.label ? `${cls.level} · ${cls.label}` : cls.level}
              </p>
            ) : (
              <NavButton
                active={classActive}
                label={cls.label ? `${cls.level} · ${cls.label}` : cls.level}
                count={cls.count}
                onClick={() => onChange({ kind: "class", classId: cls.class_id })}
              />
            )}
            {hasStreams &&
              cls.streams.map((stream) => {
                const streamActive =
                  scope.kind === "stream" &&
                  scope.classId === cls.class_id &&
                  scope.streamId === stream.stream_id;
                return (
                  <NavButton
                    key={stream.stream_id}
                    active={streamActive}
                    label={stream.name}
                    count={stream.count}
                    indent
                    onClick={() =>
                      onChange({
                        kind: "stream",
                        classId: cls.class_id,
                        streamId: stream.stream_id,
                      })
                    }
                  />
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
