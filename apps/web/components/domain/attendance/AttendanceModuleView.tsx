"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { AdminAttendanceSection } from "./AdminAttendanceSection";
import { TeacherAttendanceSection } from "./TeacherAttendanceSection";

export function AttendanceModuleView() {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <PageLoader />;

  const subscribed = user.modules.includes("attendance");
  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="check" size={18} />}
        title="Attendance module not enabled"
        description="Contact SkulPulse to add the Attendance module to your subscription."
      />
    );
  }

  // Teachers record attendance from their own timetable lessons. Everyone else
  // (admins, deputy heads) gets a read-only view of school-wide stats and the
  // per-class records.
  if (user.role === "teacher") {
    return <TeacherAttendanceSection />;
  }

  return <AdminAttendanceSection />;
}
