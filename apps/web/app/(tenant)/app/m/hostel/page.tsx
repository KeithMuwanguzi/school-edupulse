"use client";

import { HostelModuleView } from "@/components/domain/hostel/HostelModuleView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/store/hooks";

export default function HostelPage() {
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("hostel");

  if (!subscribed) {
    return (
      <EmptyState
        title="Not subscribed"
        description="Boarding & Hostel is not part of your current subscription."
      />
    );
  }

  return <HostelModuleView />;
}
