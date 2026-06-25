"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import type { RosterScope } from "@/lib/types";
import { useListClassesQuery, useListStudentsQuery, useRosterSummaryQuery } from "@/store/api/skulpulseApi";
import { ClassStreamNavigator } from "./ClassStreamNavigator";
import { StudentOverviewCards } from "./StudentOverviewCards";
import { StudentBulkMoveBar } from "./StudentBulkMoveBar";
import { StudentRosterTable } from "./StudentRosterTable";
import {
  defaultRosterScope,
  defaultTeacherRosterScope,
  scopeLabel,
  scopeToListParams,
} from "./rosterScope";

interface StudentRosterSectionProps {
  onEnroll: () => void;
  onImport: () => void;
  isAdmin: boolean;
  isTeacher?: boolean;
}

export function StudentRosterSection({
  onEnroll,
  onImport,
  isAdmin,
  isTeacher = false,
}: StudentRosterSectionProps) {
  const router = useRouter();
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: fetchingSummary } =
    useRosterSummaryQuery();
  const { data: classes = [], refetch: refetchClasses, isFetching: fetchingClasses } =
    useListClassesQuery();
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [query, setQuery] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);

  useEffect(() => {
    if (scope === null && summary) {
      setScope(isTeacher ? defaultTeacherRosterScope(summary) : defaultRosterScope(summary));
    }
  }, [summary, scope, isTeacher]);

  useEffect(() => {
    if (!isTeacher || !scope || !summary) return;
    if (scope.kind === "overview" || scope.kind === "unassigned") {
      setScope(defaultTeacherRosterScope(summary));
    }
  }, [isTeacher, scope, summary]);

  const listParams = useMemo(
    () => (scope ? scopeToListParams(scope, query) : undefined),
    [scope, query],
  );

  const { data: page, isLoading: listLoading, refetch: refetchStudents, isFetching: fetchingStudents } =
    useListStudentsQuery(listParams, {
    skip: !listParams,
  });

  const isRefreshing = fetchingSummary || fetchingClasses || fetchingStudents;

  async function refreshAll() {
    await refreshQueries(refetchSummary, refetchClasses, refetchStudents);
  }

  const students = page?.items ?? [];
  const rosterTitle = scope ? scopeLabel(scope, summary) : "Students";
  const emptyMessage =
    scope?.kind === "unassigned"
      ? "No unassigned students — everyone is in a class."
      : "No students in this roster yet.";

  const visibleTotal = isTeacher ? summary?.total ?? 0 : summary?.total ?? 0;
  const hasAnyStudents = visibleTotal > 0 || (isTeacher && (summary?.classes.length ?? 0) > 0);

  function toggleBulkSelect(studentId: string) {
    setBulkSelected((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }

  function toggleBulkAll(ids: string[], select: boolean) {
    setBulkSelected((prev) => {
      if (!select) return prev.filter((id) => !ids.includes(id));
      const merged = new Set([...prev, ...ids]);
      return [...merged];
    });
  }

  const actions = isAdmin ? (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={onImport}>
        <Icon name="inbox" size={13} />
        Import
      </Button>
      <Button size="sm" onClick={onEnroll}>
        <Icon name="plus" size={13} />
        Enroll student
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hasAnyStudents && summary ? (
          <SettingsStatRow
            items={
              isTeacher
                ? [
                    { label: "My classes", value: summary.classes.length },
                    { label: "My learners", value: summary.total },
                  ]
                : [
                    { label: "Students", value: summary.total },
                    { label: "Classes", value: summary.classes.length },
                    { label: "Unassigned", value: summary.unassigned },
                  ]
            }
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Link
            href="/app/m/students/term"
            className="hidden items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 sm:inline-flex"
          >
            <Icon name="clipboard" size={12} />
            Term check-in
          </Link>
          {hasAnyStudents && (
            <div className="relative">
              <Icon
                name="search"
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students…"
                className="w-44 pl-8"
                aria-label="Search students"
              />
            </div>
          )}
          <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh students" />
          {actions}
        </div>
      </div>

      {summaryLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading roster…</Card>
      ) : !summary || (!hasAnyStudents && !isTeacher) ? (
        <EmptyState
          icon={<Icon name="graduation" size={18} />}
          title={isTeacher ? "No assigned classes yet" : "No students enrolled yet"}
          description={
            isTeacher
              ? "Ask your administrator to assign you to a class under Teachers."
              : "Enroll students one by one, or import a class list from a spreadsheet."
          }
          action={
            isAdmin ? (
              <Button size="sm" onClick={onEnroll}>
                <Icon name="plus" size={13} />
                Enroll your first student
              </Button>
            ) : undefined
          }
        />
      ) : scope ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full shrink-0 lg:w-48">
            <Card className="p-1.5 lg:sticky lg:top-2">
              <ClassStreamNavigator
                summary={summary}
                scope={scope}
                teacherMode={isTeacher}
                onChange={(next) => {
                  setScope(next);
                  setBulkSelected([]);
                }}
              />
            </Card>
          </div>
          <div className="min-w-0 flex-1">
            {scope.kind === "overview" && !isTeacher ? (
              <StudentOverviewCards
                summary={summary}
                onSelect={(next) => {
                  setScope(next);
                  setBulkSelected([]);
                }}
              />
            ) : (
              <div className="space-y-3">
                {isAdmin && bulkSelected.length > 0 && (
                  <StudentBulkMoveBar
                    selectedIds={bulkSelected}
                    classes={classes}
                    onClear={() => setBulkSelected([])}
                    onDone={() => setBulkSelected([])}
                  />
                )}
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                    <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                      {rosterTitle}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      <span className="font-medium tabular-nums text-slate-600">
                        {students.length}
                      </span>{" "}
                      shown
                      {!isTeacher && (
                        <>
                          {" "}
                          · {summary.total} in school
                        </>
                      )}
                    </span>
                  </div>
                  <div className="px-1.5 py-1">
                    <StudentRosterTable
                      students={students}
                      isLoading={listLoading}
                      onSelect={(s) => router.push(`/app/m/students/${s.id}`)}
                      emptyMessage={emptyMessage}
                      selectable={isAdmin}
                      selectedIds={bulkSelected}
                      onToggleSelect={toggleBulkSelect}
                      onToggleAll={toggleBulkAll}
                    />
                  </div>
                  {page?.has_more && (
                    <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                      Showing first {students.length} — narrow with search.
                    </p>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes yet"
          description="Set up classes under the Academic year settings to organize rosters."
        />
      )}
    </div>
  );
}
