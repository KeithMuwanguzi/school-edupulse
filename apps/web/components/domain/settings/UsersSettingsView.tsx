"use client";

import { useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { useAppSelector } from "@/store/hooks";
import { useListTenantUsersQuery } from "@/store/api/skulpulseApi";
import { UserAddSection } from "./users/UserAddSection";
import { UserDirectorySection } from "./users/UserDirectorySection";

type UsersView = "directory" | "add";

export function UsersSettingsView() {
  const me = useAppSelector((s) => s.auth.user);
  const { data: users, isLoading, isError, refetch, isFetching } = useListTenantUsersQuery();
  const [view, setView] = useState<UsersView>("directory");

  const schoolCode = me?.tenant?.school_code ?? "SCHOOL";
  const list = users ?? [];

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load users." />;

  if (view === "add") {
    return <UserAddSection schoolCode={schoolCode} onBack={() => setView("directory")} />;
  }

  return (
    <UserDirectorySection
      users={list}
      currentUserId={me?.id}
      onAddUser={() => setView("add")}
      onRefresh={refetch}
      isRefreshing={isFetching}
    />
  );
}
