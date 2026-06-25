"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { StudentOnboardingWizard } from "@/components/domain/students/StudentOnboardingWizard";

export default function StudentEnrollPage() {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <PageLoader />;
  if (!user.modules.includes("students")) {
    return (
      <EmptyState
        icon={<Icon name="graduation" size={18} />}
        title="Students module not enabled"
        description="Contact SkulPulse to add the Students module to your subscription."
      />
    );
  }
  if (user.role !== "school_admin") {
    return <ErrorBanner message="Only school administrators can enroll students." />;
  }
  return <StudentOnboardingWizard backHref="/app/m/students" />;
}
