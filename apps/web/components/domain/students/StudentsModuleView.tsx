"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { StudentRosterSection } from "./StudentRosterSection";
import { StudentImportSection } from "./StudentImportSection";

export function StudentsModuleView() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const [importing, setImporting] = useState(false);

  const subscribed = user?.modules.includes("students") ?? false;
  const isAdmin = user?.role === "school_admin";
  const isTeacher = user?.role === "teacher";

  if (!user) return <PageLoader />;

  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="graduation" size={18} />}
        title="Students module not enabled"
        description="Contact SkulPulse to add the Students module to your subscription."
      />
    );
  }

  if (importing) {
    if (!isAdmin) {
      return <ErrorBanner message="Only school administrators can import students." />;
    }
    return <StudentImportSection onBack={() => setImporting(false)} />;
  }

  return (
    <StudentRosterSection
      onEnroll={() => router.push("/app/m/students/enroll")}
      onImport={() => setImporting(true)}
      isAdmin={isAdmin}
      isTeacher={isTeacher}
    />
  );
}
