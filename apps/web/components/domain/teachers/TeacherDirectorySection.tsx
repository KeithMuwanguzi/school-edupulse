"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
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

  const assignmentsPanel = (
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
  );

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex flex-col gap-3">
        <SettingsStatRow
          items={[
            ...(periodLabel ? [{ label: "Period", value: periodLabel }] : []),
            { label: "Staff", value: stats.staff },
            { label: "Assignments", value: stats.assignments },
          ]}
        />
        <PageToolbar>
          {isAdmin && (
            <PageToolbarGroup>
              <Button size="sm" className="w-full sm:w-auto" onClick={onAssign}>
                <Icon name="plus" size={13} />
                Add assignment
              </Button>
            </PageToolbarGroup>
          )}
          <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh teachers" />
        </PageToolbar>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className={`min-w-0 flex-1 ${selectedId ? "hidden lg:block" : ""}`}>
          <Card>
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                Teaching staff
              </h3>
            </div>
            <div className="space-y-2 p-2 md:hidden">
              {staff.map((row: TeacherStaffOut) => {
                const active = selectedId === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-brand-200 bg-brand-50/60 ring-1 ring-brand-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className={`text-[13px] font-medium ${active ? "text-brand-800" : "text-slate-900"}`}>
                      {row.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">{row.username}</p>
                    <p className="mt-1 text-[11px] capitalize text-slate-500">
                      {row.role.replace("_", " ")} · {row.assignment_count} assigned
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="hidden px-1.5 py-1 md:block">
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

        <div className="min-w-0 flex-1">
          {selected && (
            <div className="mb-3 lg:hidden">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
              >
                <Icon name="chevron-left" size={13} />
                All staff
              </button>
              <p className="mt-1 text-[12px] font-semibold text-slate-900">{selected.name}</p>
            </div>
          )}
          <div className={selectedId ? "" : "hidden lg:block"}>{assignmentsPanel}</div>
        </div>
      </div>
    </div>
  );
}
