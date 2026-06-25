"use client";

import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { NewAdmissionApplicationsView } from "@/components/domain/admissions/NewAdmissionApplicationsView";

export default function NewAdmissionPage() {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <PageLoader />;
  if (!user.modules.includes("admissions")) {
    return (
      <EmptyState
        icon={<Icon name="clipboard" size={18} />}
        title="Admissions module not enabled"
        description="Contact SkulPulse to add the Admissions pipeline to your subscription."
      />
    );
  }
  if (user.role !== "school_admin") {
    return <ErrorBanner message="Only school administrators can record applications." />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <NewAdmissionApplicationsView />
    </Suspense>
  );
}
