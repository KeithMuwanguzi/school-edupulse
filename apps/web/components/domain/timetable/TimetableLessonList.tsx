"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { TimetableSlotOut } from "@/lib/types";
import {
  DAY_NAMES,
  WEEK_DAYS,
  classLabel,
  fmtTime,
  sortByStart,
  todayWeekday,
} from "./timetableUtils";

interface TimetableLessonListProps {
  slots: TimetableSlotOut[];
  /** When set, only show this ISO weekday (1=Mon … 7=Sun). */
  dayFilter?: number;
  showTeacher?: boolean;
  showClass?: boolean;
  highlightToday?: boolean;
  onEdit?: (slot: TimetableSlotOut) => void;
  onDelete?: (id: string) => void;
  emptyMessage?: string;
}

function LessonRow({
  slot,
  showTeacher,
  showClass,
  onEdit,
  onDelete,
}: {
  slot: TimetableSlotOut;
  showTeacher?: boolean;
  showClass?: boolean;
  onEdit?: (slot: TimetableSlotOut) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
      <div className="w-[4.5rem] shrink-0 tabular-nums">
        <p className="text-[12px] font-semibold text-slate-800">{fmtTime(slot.starts_at)}</p>
        <p className="text-[10px] text-slate-400">{fmtTime(slot.ends_at)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-900">{slot.subject_code}</p>
        <p className="text-[11px] text-slate-500">{slot.subject_name}</p>
        {(showClass ?? true) && (
          <p className="mt-0.5 text-[11px] text-slate-500">{classLabel(slot)}</p>
        )}
        {showTeacher && (
          <p className="text-[11px] text-slate-400">{slot.teacher_name}</p>
        )}
        {slot.room && <p className="text-[10px] text-slate-400">{slot.room}</p>}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 flex-col gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(slot)}
              aria-label="Edit lesson"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-700"
            >
              <Icon name="edit" size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(slot.id)}
              aria-label="Remove lesson"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TimetableLessonList({
  slots,
  dayFilter,
  showTeacher = true,
  showClass = true,
  highlightToday = false,
  onEdit,
  onDelete,
  emptyMessage = "No lessons scheduled.",
}: TimetableLessonListProps) {
  const today = todayWeekday();

  const byDay = useMemo(() => {
    const days = dayFilter != null ? [dayFilter] : [...WEEK_DAYS];
    return days
      .map((d) => ({
        day: d,
        lessons: slots.filter((s) => s.day_of_week === d).slice().sort(sortByStart),
      }))
      .filter((g) => g.lessons.length > 0);
  }, [slots, dayFilter]);

  if (byDay.length === 0) {
    return (
      <Card className="p-6 text-center text-[12px] text-slate-400">{emptyMessage}</Card>
    );
  }

  return (
    <div className="space-y-3">
      {byDay.map(({ day, lessons }) => {
        const isToday = highlightToday && day === today;
        return (
          <Card key={day}>
            <div
              className={cn(
                "border-b border-slate-100 px-4 py-2.5",
                isToday && "bg-brand-50/50",
              )}
            >
              <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-tight text-slate-900">
                {DAY_NAMES[day]}
                {isToday && (
                  <span className="rounded-full bg-brand-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                    Today
                  </span>
                )}
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {lessons.map((s) => (
                <LessonRow
                  key={s.id}
                  slot={s}
                  showTeacher={showTeacher}
                  showClass={showClass}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
