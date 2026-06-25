"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";
import { AdmissionsPipelineView } from "./AdmissionsPipelineView";

export function AdmissionsModuleView() {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("admissions") ?? false;
  const isAdmin = user?.role === "school_admin";

  if (!user) return <PageLoader />;

  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="clipboard" size={18} />}
        title="Admissions module not enabled"
        description="Contact SkulPulse to add the Admissions pipeline to your subscription."
      />
    );
  }

  return <AdmissionsPipelineView isAdmin={isAdmin} />;
}
