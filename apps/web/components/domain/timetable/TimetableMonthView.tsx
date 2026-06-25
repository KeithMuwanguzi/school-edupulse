"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { TimetableSlotOut } from "@/lib/types";
import {
  DAY_SHORT,
  WEEK_DAYS,
  buildMonthGrid,
  fmtTime,
  isoWeekday,
  monthLabel,
} from "./timetableUtils";

interface TimetableMonthViewProps {
  slots: TimetableSlotOut[];
  /** When false, hide the class line in cells (teacher viewing their own). */
  showClass?: boolean;
}

const MAX_PER_CELL = 3;

export function TimetableMonthView({ slots, showClass = true }: TimetableMonthViewProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const month = cursor.getMonth();
  const todayKey = new Date().toDateString();

  const byWeekday = useMemo(() => {
    const map = new Map<number, TimetableSlotOut[]>();
    for (const d of WEEK_DAYS) map.set(d, []);
    for (const s of slots) map.get(s.day_of_week)?.push(s);
    for (const d of WEEK_DAYS) {
      map.get(d)!.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [slots]);

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="chevron-left" size={15} />
          </button>
          <span className="min-w-[9rem] text-center text-[12px] font-semibold tracking-tight text-slate-900">
            {monthLabel(cursor)}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="chevron-right" size={15} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCursor(new Date())}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            {DAY_SHORT[d]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((date, i) => {
          const inMonth = date.getMonth() === month;
          const lessons = byWeekday.get(isoWeekday(date)) ?? [];
          const isToday = date.toDateString() === todayKey;
          const shown = lessons.slice(0, MAX_PER_CELL);
          return (
            <div
              key={i}
              className={`min-h-[88px] border-b border-r border-slate-100 p-1 [&:nth-child(7n)]:border-r-0 ${
                inMonth ? "" : "bg-slate-50/40"
              }`}
            >
              <div className="mb-0.5 flex justify-end">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${
                    isToday
                      ? "bg-brand-600 font-semibold text-white"
                      : inMonth
                        ? "text-slate-500"
                        : "text-slate-300"
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {shown.map((s) => (
                  <div
                    key={s.id}
                    title={`${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)} · ${s.subject_code}${
                      showClass ? ` · ${s.stream_name ? `${s.class_level} ${s.stream_name}` : s.class_level}` : ""
                    }`}
                    className={`truncate rounded px-1 py-px text-[10px] leading-tight ${
                      inMonth ? "bg-brand-50/70 text-brand-800" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span className="tabular-nums">{fmtTime(s.starts_at)}</span> {s.subject_code}
                  </div>
                ))}
                {lessons.length > shown.length && (
                  <div className="px-1 text-[9px] font-medium text-slate-400">
                    +{lessons.length - shown.length} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
