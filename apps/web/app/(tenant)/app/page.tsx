"use client";

import { ParentDashboardView } from "@/components/domain/parent/ParentDashboardView";
import { StaffDashboardView } from "@/components/domain/dashboard/StaffDashboardView";
import { useAppSelector } from "@/store/hooks";

export default function TenantDashboard() {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return null;

  if (user.role === "parent") {
    return <ParentDashboardView userName={user.name} />;
  }

  return <StaffDashboardView user={user} />;
}
