"use client";

import { AssessmentModuleShell } from "@/components/domain/assessment/AssessmentModuleShell";
import { PleCandidacyView } from "@/components/domain/assessment/PleCandidacyView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/store/hooks";

export default function PleCandidacyPage() {
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
      <PleCandidacyView />
    </AssessmentModuleShell>
  );
}
