"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { TimetableSlotOut } from "@/lib/types";
import { DAY_NAMES, WEEK_DAYS, fmtTime, sortByStart } from "./timetableUtils";

/** Mobile-friendly recurring weekly pattern (replaces the month grid on small screens). */
export function TimetableMonthAgenda({
  slots,
  showClass = true,
}: {
  slots: TimetableSlotOut[];
  showClass?: boolean;
}) {
  const byDay = useMemo(
    () =>
      WEEK_DAYS.map((d) => ({
        day: d,
        lessons: slots.filter((s) => s.day_of_week === d).slice().sort(sortByStart),
      })).filter((g) => g.lessons.length > 0),
    [slots],
  );

  if (byDay.length === 0) {
    return (
      <Card className="p-6 text-center text-[12px] text-slate-400">
        No weekly lessons in this timetable.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">
        Weekly pattern — the same schedule repeats each week during term.
      </p>
      {byDay.map(({ day, lessons }) => (
        <Card key={day}>
          <div className="border-b border-slate-100 px-3 py-2">
            <h3 className="text-[12px] font-semibold text-slate-800">{DAY_NAMES[day]}</h3>
          </div>
          <ul className="divide-y divide-slate-50">
            {lessons.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 tabular-nums text-[11px] font-medium text-slate-600">
                  {fmtTime(s.starts_at)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-slate-800">
                  {s.subject_code}
                  {showClass && (
                    <span className="text-slate-400">
                      {" "}
                      · {s.stream_name ? `${s.class_level} ${s.stream_name}` : s.class_level}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
