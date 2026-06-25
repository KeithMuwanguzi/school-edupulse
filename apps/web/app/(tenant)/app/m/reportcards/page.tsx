"use client";

import { ReportCardsView } from "@/components/domain/reportcards/ReportCardsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/store/hooks";

export default function ReportCardsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("reportcards");

  if (!subscribed) {
    return (
      <EmptyState
        title="Not subscribed"
        description="Report cards are not part of your current subscription."
      />
    );
  }

  return <ReportCardsView />;
}
