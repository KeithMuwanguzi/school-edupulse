"use client";

import { useState } from "react";
import {
  SettingsFilterPills,
  SettingsStatRow,
} from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton } from "@/components/ui/RefreshButton";
import type { PortalUser } from "@/lib/types";
import { UserCatalogList } from "./UserCatalogList";

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "staff", label: "Staff" },
  { id: "parent", label: "Parents" },
  { id: "school_admin", label: "Admins" },
  { id: "teacher", label: "Teachers" },
];

interface UserDirectorySectionProps {
  users: PortalUser[];
  currentUserId?: string;
  onAddUser: () => void;
  onRefresh?: () => unknown;
  isRefreshing?: boolean;
}

export function UserDirectorySection({
  users,
  currentUserId,
  onAddUser,
  onRefresh,
  isRefreshing,
}: UserDirectorySectionProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const staffCount = users.filter((u) => u.role !== "parent").length;
  const parentCount = users.filter((u) => u.role === "parent").length;
  const activeCount = users.filter((u) => u.status === "active").length;

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="users" size={18} />}
        title="No accounts yet"
        description="Add staff and guardian portal accounts so they can sign in."
        action={
          <Button size="sm" onClick={onAddUser}>
            <Icon name="plus" size={13} />
            Add your first user
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SettingsStatRow
          items={[
            { label: "Total", value: users.length },
            { label: "Staff", value: staffCount },
            { label: "Parents", value: parentCount },
            { label: "Active", value: activeCount },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon
              name="search"
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="w-44 pl-8"
              aria-label="Search users"
            />
          </div>
          <Button size="sm" onClick={onAddUser}>
            <Icon name="plus" size={13} />
            Add user
          </Button>
          {onRefresh && (
            <RefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} label="Refresh users" />
          )}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <SettingsFilterPills options={ROLE_FILTERS} active={roleFilter} onChange={setRoleFilter} />
        </div>
        <div className="px-1.5 py-1.5">
          <UserCatalogList
            users={users}
            search={query}
            roleFilter={roleFilter}
            currentUserId={currentUserId}
          />
        </div>
      </Card>
    </div>
  );
}
