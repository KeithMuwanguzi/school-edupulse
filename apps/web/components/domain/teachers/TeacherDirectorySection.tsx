"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { TeacherStaffOut } from "@/lib/types";
import {
  useAcademicContextQuery,
  useListTeacherAssignmentsQuery,
  useListTeacherStaffQuery,
} from "@/store/api/skulpulseApi";
import { TeacherAssignmentList } from "./TeacherAssignmentList";

interface TeacherDirectorySectionProps {
  onAssign: () => void;
  isAdmin: boolean;
}

export function TeacherDirectorySection({
  onAssign,
  isAdmin,
}: TeacherDirectorySectionProps) {
  const { data: context, refetch: refetchContext, isFetching: fetchingContext } =
    useAcademicContextQuery();
  const { data: staff = [], isLoading, refetch: refetchStaff, isFetching: fetchingStaff } =
    useListTeacherStaffQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = staff.find((s) => s.id === selectedId) ?? null;
  const { data: assignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments, isFetching: fetchingAssignments } =
    useListTeacherAssignmentsQuery(
      selectedId ? { teacherUserId: selectedId } : undefined,
      { skip: !selectedId },
    );

  const isRefreshing = fetchingContext || fetchingStaff || fetchingAssignments;

  async function refreshAll() {
    await refreshQueries(refetchContext, refetchStaff, refetchAssignments);
  }

  const stats = useMemo(() => {
    const totalAssignments = staff.reduce((sum, s) => sum + s.assignment_count, 0);
    return { staff: staff.length, assignments: totalAssignments };
  }, [staff]);

  const periodLabel = useMemo(() => {
    const year = context?.academic_year?.label;
    const term = context?.active_term?.label;
    if (year && term) return `${year} · ${term}`;
    if (year) return year;
    return null;
  }, [context]);

  if (isLoading) {
    return <Card className="p-8 text-center text-[12px] text-slate-400">Loading staff…</Card>;
  }

  if (staff.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="user" size={18} />}
        title="No teaching staff yet"
        description="Add teachers under Settings → Users with the teacher or deputy head role; they appear here automatically."
        action={
          <Link href="/app/settings/users">
            <Button size="sm" variant="secondary">
              Go to Users
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SettingsStatRow
          items={[
            ...(periodLabel ? [{ label: "Period", value: periodLabel }] : []),
            { label: "Staff", value: stats.staff },
            { label: "Assignments", value: stats.assignments },
          ]}
        />
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" onClick={onAssign}>
              <Icon name="plus" size={13} />
              Add assignment
            </Button>
          )}
          <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh teachers" />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Staff list */}
        <div className="min-w-0 flex-1">
          <Card>
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                Teaching staff
              </h3>
            </div>
            <div className="px-1.5 py-1">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH className="hidden sm:table-cell">Role</TH>
                    <TH>Assigned</TH>
                  </tr>
                </THead>
                <TBody>
                  {staff.map((row: TeacherStaffOut) => {
                    const active = selectedId === row.id;
                    return (
                      <TR key={row.id} onClick={() => setSelectedId(row.id)}>
                        <TD className={active ? "font-medium text-brand-800" : undefined}>
                          <span className="block truncate">{row.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {row.username}
                          </span>
                        </TD>
                        <TD className="hidden capitalize text-slate-400 sm:table-cell">
                          {row.role.replace("_", " ")}
                        </TD>
                        <TD className="tabular-nums text-slate-600">{row.assignment_count}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Selected teacher's assignments */}
        <div className="min-w-0 flex-1">
          <Card>
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h3 className="truncate text-[12px] font-semibold tracking-tight text-slate-900">
                {selected ? `${selected.name}'s assignments` : "Assignments"}
              </h3>
            </div>
            <div className="p-3">
              {!selected ? (
                <p className="py-6 text-center text-[12px] text-slate-400">
                  Select a teacher to view their classes and subjects.
                </p>
              ) : assignmentsLoading ? (
                <p className="py-6 text-center text-[12px] text-slate-400">Loading…</p>
              ) : (
                <TeacherAssignmentList assignments={assignments} isAdmin={isAdmin} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
