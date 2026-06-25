"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { TeacherAssignSection } from "./TeacherAssignSection";
import { TeacherDirectorySection } from "./TeacherDirectorySection";

type TeachersView = "directory" | "assign";

export function TeachersModuleView() {
  const user = useAppSelector((s) => s.auth.user);
  const [view, setView] = useState<TeachersView>("directory");

  const subscribed = user?.modules.includes("teachers") ?? false;
  const isAdmin = user?.role === "school_admin";

  if (!user) return <PageLoader />;

  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="user" size={18} />}
        title="Teachers module not enabled"
        description="Contact SkulPulse to add the Teachers module to your subscription."
      />
    );
  }

  if (view === "assign") {
    if (!isAdmin) {
      return (
        <ErrorBanner message="Only school administrators can manage teaching assignments." />
      );
    }
    return <TeacherAssignSection onBack={() => setView("directory")} />;
  }

  return (
    <TeacherDirectorySection
      onAssign={() => setView("assign")}
      isAdmin={isAdmin}
    />
  );
}
