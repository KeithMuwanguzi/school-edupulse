"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { useListTimetableSlotsQuery } from "@/store/api/skulpulseApi";
import { TimetableMonthView } from "./TimetableMonthView";
import { TimetableViewToggle, type TimetableViewMode } from "./TimetableViewToggle";
import { DAY_NAMES, WEEK_DAYS, classLabel, fmtTime, sortByStart } from "./timetableUtils";

interface TimetableWeekViewProps {
  /** When set, only this teacher's lessons are shown. */
  mineUserId?: string;
}

export function TimetableWeekView({ mineUserId }: TimetableWeekViewProps) {
  const { data: all = [], isLoading, isError } = useListTimetableSlotsQuery();
  const [viewMode, setViewMode] = useState<TimetableViewMode>("week");

  const slots = useMemo(
    () => (mineUserId ? all.filter((s) => s.teacher_user_id === mineUserId) : all),
    [all, mineUserId],
  );
  const byDay = useMemo(() => {
    return WEEK_DAYS.map((d) => ({
      day: d,
      lessons: slots.filter((s) => s.day_of_week === d).slice().sort(sortByStart),
    })).filter((g) => g.lessons.length > 0);
  }, [slots]);

  if (isLoading) {
    return <Card className="p-8 text-center text-[12px] text-slate-400">Loading timetable…</Card>;
  }
  if (isError) {
    return <ErrorBanner message="Couldn't load the timetable. Please refresh and try again." />;
  }
  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="calendar" size={18} />}
        title={mineUserId ? "No lessons scheduled for you" : "No timetable yet"}
        description={
          mineUserId
            ? "Your school admin hasn't scheduled any lessons for you yet."
            : "The weekly timetable has not been set up yet."
        }
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex justify-end">
        <TimetableViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === "month" ? (
        <TimetableMonthView slots={slots} showClass={!mineUserId} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map(({ day, lessons }) => (
        <Card key={day}>
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
              {DAY_NAMES[day]}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {lessons.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                <div className="w-20 shrink-0 tabular-nums text-[11px] font-medium text-slate-700">
                  {fmtTime(s.starts_at)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-slate-900">{s.subject_code}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {classLabel(s)}
                    {mineUserId ? "" : ` · ${s.teacher_name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
          ))}
        </div>
      )}
    </div>
  );
}
