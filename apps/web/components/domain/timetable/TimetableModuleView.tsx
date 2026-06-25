"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { TimetableBuilderSection } from "./TimetableBuilderSection";
import { TimetableWeekView } from "./TimetableWeekView";

export function TimetableModuleView() {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <PageLoader />;

  if (!user.modules.includes("timetable")) {
    return (
      <EmptyState
        icon={<Icon name="calendar" size={18} />}
        title="Timetable module not enabled"
        description="Contact SkulPulse to add the Timetable module to your subscription."
      />
    );
  }

  if (user.role === "school_admin") {
    return <TimetableBuilderSection />;
  }

  // Teachers and other staff see their own weekly schedule, read-only.
  return <TimetableWeekView mineUserId={user.id} />;
}
