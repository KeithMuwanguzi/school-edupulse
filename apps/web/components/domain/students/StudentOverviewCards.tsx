"use client";

import { cn } from "@/lib/cn";
import type { RosterScope, RosterSummaryOut } from "@/lib/types";

import { ALL_CLASS_LEVELS } from "@/lib/schoolLevels";

interface StudentOverviewCardsProps {
  summary: RosterSummaryOut;
  onSelect: (scope: RosterScope) => void;
}

export function StudentOverviewCards({ summary, onSelect }: StudentOverviewCardsProps) {
  const byLevel = new Map(summary.classes.map((c) => [c.level, c]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ALL_CLASS_LEVELS.map((level) => {
          const row = byLevel.get(level);
          const count = row?.count ?? 0;
          const streamCount = row?.streams.filter((s) => s.count > 0).length ?? 0;
          return (
            <button
              key={level}
              type="button"
              disabled={!row}
              onClick={() => row && onSelect({ kind: "class", classId: row.class_id })}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition",
                row
                  ? "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30"
                  : "cursor-not-allowed border-slate-100 bg-slate-50/50 opacity-60",
              )}
            >
              <p className="text-[11px] font-medium text-slate-700">{level}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-800">
                {count}
              </p>
              <p className="text-[10px] text-slate-400">
                {!row ? "Not set up" : streamCount > 0 ? `${streamCount} stream(s)` : "learners"}
              </p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelect({ kind: "unassigned" })}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition",
            summary.unassigned > 0
              ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <p className="text-[11px] font-medium text-slate-700">Unassigned</p>
          <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-800">
            {summary.unassigned}
          </p>
          <p className="text-[10px] text-slate-400">need a class</p>
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        School total{" "}
        <span className="font-medium tabular-nums text-slate-600">{summary.total}</span> enrolled
        learners. Select a class to open its roster.
      </p>
    </div>
  );
}
