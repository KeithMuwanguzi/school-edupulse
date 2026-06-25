"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { StudentOnboardingWizard } from "@/components/domain/students/StudentOnboardingWizard";

export default function AdmissionEnrollPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <PageLoader />;
  if (!user.modules.includes("admissions") || !user.modules.includes("students")) {
    return (
      <EmptyState
        icon={<Icon name="clipboard" size={18} />}
        title="Admissions and Students required"
        description="Both the Admissions and Students modules must be enabled to enroll applicants."
      />
    );
  }
  if (user.role !== "school_admin") {
    return <ErrorBanner message="Only school administrators can enroll applicants." />;
  }
  return (
    <StudentOnboardingWizard
      applicationId={applicationId}
      backHref="/app/m/admissions"
    />
  );
}
