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
import { TablePagination } from "@/components/ui/TablePagination";
import { useCursorPageStack } from "@/hooks/useCursorPageStack";
import { ROSTER_PAGE_SIZE } from "@/lib/rosterConstants";
import { exportStudentRosterExcel } from "@/lib/rosterExport";
import { fetchAllStudents } from "@/lib/rosterExportFetch";
import { parseError } from "@/lib/apiError";
import type { RosterScope } from "@/lib/types";
import { useListClassesQuery, useListStudentsQuery, useRosterSummaryQuery } from "@/store/api/skulpulseApi";
import type { RootState } from "@/store";
import { useSelector } from "react-redux";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { useToast } from "@/components/ui/Toast";
import { ClassStreamPicker } from "./ClassStreamPicker";
import { RosterExportButton } from "./RosterExportButton";
import { RosterScopeLayout } from "./RosterScopeLayout";
import { StudentOverviewCards } from "./StudentOverviewCards";
import { StudentBulkMoveBar } from "./StudentBulkMoveBar";
import { StudentRosterTable } from "./StudentRosterTable";
import {
  defaultRosterScope,
  defaultTeacherRosterScope,
  exportScopeToApiParams,
  rosterCountForScope,
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
  const { toast } = useToast();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: fetchingSummary } =
    useRosterSummaryQuery();
  const { data: classes = [], refetch: refetchClasses, isFetching: fetchingClasses } =
    useListClassesQuery();
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [query, setQuery] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);

  const paginationResetKey = useMemo(() => {
    if (!scope) return "none";
    if (scope.kind === "overview") return "overview";
    if (scope.kind === "unassigned") return `unassigned:${query}`;
    if (scope.kind === "class") return `class:${scope.classId}:${query}`;
    return `stream:${scope.classId}:${scope.streamId}:${query}`;
  }, [scope, query]);

  const { page: listPage, cursor, goNext, goPrevious } = useCursorPageStack(paginationResetKey);

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

  const listParams = useMemo(() => {
    if (!scope) return undefined;
    const base = scopeToListParams(scope, query);
    if (!base) return undefined;
    return { ...base, cursor };
  }, [scope, query, cursor]);

  const { data: studentPage, isLoading: listLoading, refetch: refetchStudents, isFetching: fetchingStudents } =
    useListStudentsQuery(listParams, {
    skip: !listParams,
  });

  const isRefreshing = fetchingSummary || fetchingClasses || fetchingStudents;

  async function refreshAll() {
    await refreshQueries(refetchSummary, refetchClasses, refetchStudents);
  }

  const students = studentPage?.items ?? [];
  const rosterTotal = useMemo(() => {
    if (!scope || !summary || query.trim()) return undefined;
    return rosterCountForScope(scope, summary);
  }, [scope, summary, query]);
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

  async function handleExport() {
    if (!scope || !summary || scope.kind === "overview") return;
    const filters = exportScopeToApiParams(scope, query);
    if (!filters) return;
    try {
      const items = await fetchAllStudents(accessToken, filters);
      if (!items.length) {
        toast("No pupils match the current filters.", "error");
        return;
      }
      exportStudentRosterExcel(items, scopeLabel(scope, summary));
      toast(`Exported ${items.length} pupil(s) to Excel.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message || "Export failed.", "error", p.requestId);
    }
  }

  const canExport = scope != null && scope.kind !== "overview";

  const actions = isAdmin ? (
    <PageToolbarGroup>
      <Button size="sm" variant="secondary" onClick={onImport} className="w-full sm:w-auto">
        <Icon name="inbox" size={13} />
        Import
      </Button>
      <Button size="sm" onClick={onEnroll} className="w-full sm:w-auto">
        <Icon name="plus" size={13} />
        Enroll student
      </Button>
    </PageToolbarGroup>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
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
        ) : null}
        <PageToolbar>
          <PageToolbarGroup className="w-full sm:mr-auto sm:w-auto">
            <Link
              href="/app/m/students/term"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 sm:w-auto sm:py-1"
            >
              <Icon name="clipboard" size={12} />
              Term check-in
            </Link>
            {hasAnyStudents && (
              <div className="relative w-full sm:w-44">
                <Icon
                  name="search"
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search students…"
                  className="w-full pl-8"
                  aria-label="Search students"
                />
              </div>
            )}
          </PageToolbarGroup>
          <PageToolbarGroup>
            <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh students" />
            {actions}
          </PageToolbarGroup>
        </PageToolbar>
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
        <RosterScopeLayout
          picker={
            <ClassStreamPicker
              summary={summary}
              scope={scope}
              teacherMode={isTeacher}
              onChange={(next) => {
                setScope(next);
                setBulkSelected([]);
              }}
            />
          }
        >
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        <span className="font-medium tabular-nums text-slate-600">
                          {students.length}
                        </span>{" "}
                        on this page
                        {!isTeacher && scope.kind !== "overview" && (
                          <>
                            {" "}
                            · {summary.total} in school
                          </>
                        )}
                      </span>
                      {canExport && <RosterExportButton onExport={handleExport} />}
                    </div>
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
                  {(listPage > 1 || studentPage?.has_more || (rosterTotal ?? 0) > 0) && (
                    <div className="px-4 pb-3">
                      <TablePagination
                        page={listPage}
                        count={students.length}
                        pageSize={ROSTER_PAGE_SIZE}
                        totalItems={rosterTotal}
                        hasNext={Boolean(studentPage?.has_more)}
                        loading={listLoading}
                        onPrevious={goPrevious}
                        onNext={() => goNext(studentPage?.next_cursor)}
                      />
                    </div>
                  )}
                </Card>
              </div>
            )}
        </RosterScopeLayout>
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
