"use client";

import { useParams } from "next/navigation";
import { HostelDetailView } from "@/components/domain/hostel/HostelDetailView";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { EmptyState } from "@/components/ui/EmptyState";
import { HOSTEL_READ_ROLES, roleHasAny } from "@/lib/roleAccess";
import { useAppSelector } from "@/store/hooks";

export default function HostelDetailPage() {
  const { hostelId } = useParams<{ hostelId: string }>();
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

  if (!roleHasAny(user?.role, ...HOSTEL_READ_ROLES)) {
    return (
      <AccessDenied
        title="Boarding access restricted"
        description="Only administrators, deputy heads, and bursars can view hostel records."
      />
    );
  }

  return <HostelDetailView hostelId={hostelId} />;
}
