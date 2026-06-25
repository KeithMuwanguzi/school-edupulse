"use client";

import { useMemo } from "react";
import { SettingsEmptyState } from "@/components/layout/settingsUi";
import type { PortalUser } from "@/lib/types";
import { UserRow } from "./UserRow";

interface UserCatalogListProps {
  users: PortalUser[];
  search: string;
  roleFilter: string;
  currentUserId?: string;
}

export function UserCatalogList({
  users,
  search,
  roleFilter,
  currentUserId,
}: UserCatalogListProps) {
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (roleFilter === "all") return true;
        if (roleFilter === "staff") return u.role !== "parent";
        return u.role === roleFilter;
      })
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.login_id.includes(q),
      )
      .sort((a, b) => a.login_id.localeCompare(b.login_id));
  }, [users, search, roleFilter]);

  if (items.length === 0) {
    const q = search.trim();
    if (q) return <SettingsEmptyState message={`No users match “${q}”.`} />;
    if (roleFilter !== "all") return <SettingsEmptyState message="No users in this group." />;
    return null;
  }

  return (
    <div>
      {items.map((user) => (
        <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
      ))}
    </div>
  );
}
