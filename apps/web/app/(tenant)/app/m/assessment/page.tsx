"use client";

import { AssessmentModuleShell } from "@/components/domain/assessment/AssessmentModuleShell";
import { AssessmentModuleView } from "@/components/domain/assessment/AssessmentModuleView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/store/hooks";

export default function AssessmentPage() {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("assessment");

  if (!subscribed) {
    return (
      <EmptyState
        title="Not subscribed"
        description="Assessment is not part of your current subscription."
      />
    );
  }

  return (
    <AssessmentModuleShell>
      <AssessmentModuleView />
    </AssessmentModuleShell>
  );
}
