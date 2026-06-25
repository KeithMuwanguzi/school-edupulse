"use client";

import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { TimetableSlotOut } from "@/lib/types";
import { DAY_SHORT, WEEK_DAYS, fmtTime } from "./timetableUtils";

interface TimetableCalendarProps {
  slots: TimetableSlotOut[];
  /** Show the teacher line in each cell (off when the calendar is per-teacher). */
  showTeacher?: boolean;
  onEdit?: (slot: TimetableSlotOut) => void;
  onDelete?: (id: string) => void;
}

export function TimetableCalendar({ slots, showTeacher = true, onEdit, onDelete }: TimetableCalendarProps) {
  const days = useMemo(
    () => WEEK_DAYS.filter((d) => d <= 5 || slots.some((s) => s.day_of_week === d)),
    [slots],
  );

  const timeRows = useMemo(() => {
    const seen = new Map<string, { starts_at: string; ends_at: string }>();
    for (const s of slots) {
      const key = `${s.starts_at}|${s.ends_at}`;
      if (!seen.has(key)) seen.set(key, { starts_at: s.starts_at, ends_at: s.ends_at });
    }
    return [...seen.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [slots]);

  if (timeRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="min-w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-50/80">
            <th className="sticky left-0 z-10 w-24 bg-slate-50/80 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Time
            </th>
            {days.map((d) => (
              <th
                key={d}
                className="border-l border-slate-100 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                {DAY_SHORT[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {timeRows.map((tr) => (
            <tr key={`${tr.starts_at}|${tr.ends_at}`} className="align-top">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 tabular-nums font-medium text-slate-600">
                {fmtTime(tr.starts_at)}
                <span className="block text-[10px] text-slate-400">{fmtTime(tr.ends_at)}</span>
              </td>
              {days.map((d) => {
                const cell = slots.filter(
                  (s) =>
                    s.day_of_week === d &&
                    s.starts_at === tr.starts_at &&
                    s.ends_at === tr.ends_at,
                );
                return (
                  <td key={d} className="border-l border-slate-100 px-1.5 py-1.5">
                    <div className="space-y-1">
                      {cell.map((s) => (
                        <div
                          key={s.id}
                          className="group relative rounded-lg border border-brand-100 bg-brand-50/60 px-2 py-1.5"
                        >
                          <p className="pr-4 font-semibold text-brand-800">{s.subject_code}</p>
                          <p className="truncate text-[10px] text-slate-500">
                            {s.stream_name ? `${s.class_level} ${s.stream_name}` : s.class_level}
                            {showTeacher ? ` · ${s.teacher_name}` : ""}
                          </p>
                          {s.room && (
                            <p className="truncate text-[10px] text-slate-400">{s.room}</p>
                          )}
                          {(onEdit || onDelete) && (
                            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                              {onEdit && (
                                <button
                                  type="button"
                                  onClick={() => onEdit(s)}
                                  aria-label="Edit lesson"
                                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-brand-700"
                                >
                                  <Icon name="edit" size={12} />
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(s.id)}
                                  aria-label="Remove lesson"
                                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-red-600"
                                >
                                  <Icon name="x" size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
