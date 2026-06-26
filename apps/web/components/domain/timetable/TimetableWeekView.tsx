"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { useListTimetableSlotsQuery } from "@/store/api/skulpulseApi";
import { TimetableLessonList } from "./TimetableLessonList";
import { TimetableMonthView } from "./TimetableMonthView";
import { TimetableViewToggle, type TimetableViewMode } from "./TimetableViewToggle";
import { todayWeekday } from "./timetableUtils";

interface TimetableWeekViewProps {
  /** When set, only this teacher's lessons are shown. */
  mineUserId?: string;
}

export function TimetableWeekView({ mineUserId }: TimetableWeekViewProps) {
  const { data: all = [], isLoading, isError } = useListTimetableSlotsQuery();
  const [viewMode, setViewMode] = useState<TimetableViewMode>("today");

  const slots = useMemo(
    () => (mineUserId ? all.filter((s) => s.teacher_user_id === mineUserId) : all),
    [all, mineUserId],
  );

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

  const today = todayWeekday();
  const dayFilter = viewMode === "today" ? today : undefined;

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex justify-end">
        <TimetableViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === "month" ? (
        <TimetableMonthView slots={slots} showClass={!mineUserId} />
      ) : (
        <TimetableLessonList
          slots={slots}
          dayFilter={dayFilter}
          showTeacher={!mineUserId}
          showClass={!mineUserId}
          highlightToday={viewMode === "week"}
          emptyMessage={
            viewMode === "today"
              ? "No lessons scheduled for today."
              : "No lessons this week."
          }
        />
      )}
    </div>
  );
}
