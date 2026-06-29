"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import { TablePagination } from "@/components/ui/TablePagination";
import { useClientPageSlice } from "@/hooks/useClientPageSlice";
import { compareStudentFullName, ROSTER_PAGE_SIZE } from "@/lib/rosterConstants";
import { exportRegisteredRosterExcel } from "@/lib/rosterExport";
import { fetchRegisteredRoster } from "@/lib/rosterExportFetch";
import { parseError } from "@/lib/apiError";
import type { RosterScope } from "@/lib/types";
import {
  useAcademicContextQuery,
  useRegisteredRosterQuery,
  useRegisteredRosterSummaryQuery,
} from "@/store/api/skulpulseApi";
import type { RootState } from "@/store";
import { useSelector } from "react-redux";
import { useToast } from "@/components/ui/Toast";
import { ClassStreamPicker } from "./ClassStreamPicker";
import { RosterExportButton } from "./RosterExportButton";
import { RosterScopeLayout } from "./RosterScopeLayout";
import { formatStudentFullName } from "./studentOptions";
import {
  defaultRegisteredScope,
  exportScopeToApiParams,
  registeredScopeToListParams,
  registeredSummaryToNavSummary,
  scopeLabel,
} from "./rosterScope";

function formatRegisteredAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function TermRegisteredRosterView({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { data: academic, refetch: refetchAcademic, isFetching: fetchingAcademic } =
    useAcademicContextQuery();
  const {
    data: registeredSummary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchRegisteredSummary,
    isFetching: fetchingRegisteredSummary,
  } = useRegisteredRosterSummaryQuery();
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [query, setQuery] = useState("");

  const navSummary = useMemo(
    () => registeredSummaryToNavSummary(registeredSummary),
    [registeredSummary],
  );

  useEffect(() => {
    if (scope === null && registeredSummary) {
      setScope(defaultRegisteredScope(registeredSummary));
    }
  }, [registeredSummary, scope]);

  const listParams = useMemo(() => {
    if (!scope || scope.kind === "overview") return undefined;
    return registeredScopeToListParams(scope, query);
  }, [scope, query]);

  const termLabel = academic?.active_term?.label ?? registeredSummary?.term_label ?? "Active term";
  const { data: roster = [], isLoading: rosterLoading, refetch: refetchRoster, isFetching: fetchingRoster } =
    useRegisteredRosterQuery(listParams, {
    skip: !listParams,
  });

  const paginationResetKey = useMemo(() => {
    if (!scope) return "none";
    if (scope.kind === "unassigned") return `unassigned:${query}`;
    if (scope.kind === "class") return `class:${scope.classId}:${query}`;
    if (scope.kind === "stream") {
      return `stream:${scope.classId}:${scope.streamId}:${query}`;
    }
    return "overview";
  }, [scope, query]);

  const sortedRoster = useMemo(
    () => [...roster].sort(compareStudentFullName),
    [roster],
  );

  const {
    page: listPage,
    pageItems: rosterPage,
    total: rosterTotal,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
  } = useClientPageSlice(sortedRoster, paginationResetKey);

  const isRefreshing =
    fetchingAcademic || fetchingRegisteredSummary || fetchingRoster;

  async function refreshAll() {
    await refreshQueries(refetchAcademic, refetchRegisteredSummary, refetchRoster);
  }

  const stats = useMemo(
    () =>
      registeredSummary
        ? [
            { label: "Registered", value: registeredSummary.total_registered },
            { label: "Enrolled", value: registeredSummary.total_enrolled },
            { label: "Pending", value: registeredSummary.total_enrolled - registeredSummary.total_registered },
          ]
        : [],
    [registeredSummary],
  );

  const rosterTitle = scope ? scopeLabel(scope, navSummary) : "Select a class";

  async function handleExport() {
    if (!scope || !navSummary) return;
    const filters = exportScopeToApiParams(scope, query);
    if (!filters) return;
    try {
      const rows = await fetchRegisteredRoster(accessToken, filters);
      if (!rows.length) {
        toast("No pupils match the current filters.", "error");
        return;
      }
      exportRegisteredRosterExcel(rows, scopeLabel(scope, navSummary));
      toast(`Exported ${rows.length} pupil(s) to Excel.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message || "Export failed.", "error", p.requestId);
    }
  }

  if (summaryLoading) return <PageLoader />;

  if (summaryError) {
    return <ErrorBanner message="Couldn't load the registered roster. Please refresh and try again." />;
  }

  if (!registeredSummary || registeredSummary.total_enrolled === 0) {
    return (
      <EmptyState
        icon={<Icon name="graduation" size={18} />}
        title="No students enrolled yet"
        description="Onboard students first, then register them for the term."
      />
    );
  }

  return (
    <div className="space-y-4">
      {embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SettingsStatRow items={stats} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon
                name="search"
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in this roster…"
                className="h-7 w-44 pl-8 text-[12px]"
                disabled={!scope || scope.kind === "overview"}
              />
            </div>
            <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh roster" />
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader
            title="Registered for term"
            description={`Students fully registered for ${termLabel}. Attendance, exams, and other term activities use this roster — not the full onboarded listing.`}
            action={<RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh registered roster" />}
          />
          <CardBody className="space-y-3 py-3">
            <SettingsStatRow items={stats} />
            <div className="relative max-w-xs">
              <Icon
                name="search"
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in this roster…"
                className="h-7 w-full pl-8 text-[12px]"
                disabled={!scope || scope.kind === "overview"}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {scope && navSummary ? (
        <RosterScopeLayout
          picker={
            <ClassStreamPicker
              summary={navSummary}
              scope={scope}
              registrationMode
              onChange={setScope}
            />
          }
        >
          {rosterLoading ? (
              <PageLoader />
            ) : registeredSummary.total_registered === 0 ? (
              <EmptyState
                icon={<Icon name="clipboard" size={18} />}
                title="No registrations complete yet"
                description="Finish term registration for learners, then they will appear here."
              />
            ) : sortedRoster.length === 0 ? (
              <EmptyState
                icon={<Icon name="users" size={18} />}
                title="No registered students in this roster"
                description="Try another class or stream, or adjust your search."
              />
            ) : (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                  <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                    {rosterTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      <span className="font-medium tabular-nums text-slate-600">{sortedRoster.length}</span>{" "}
                      registered
                    </span>
                    <RosterExportButton onExport={handleExport} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Registered</th>
                        <th className="px-3 py-2 text-right">Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterPage.map((row) => (
                        <tr
                          key={row.student_id}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800">
                              {formatStudentFullName(row)}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {row.student_number}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {row.class_level ?? "—"}
                            {row.stream_name ? ` · ${row.stream_name}` : ""}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {formatRegisteredAt(row.registered_at)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {row.registration_id ? (
                              <Link
                                href={`/app/m/students/registration/${row.registration_id}`}
                                className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                              >
                                View registration
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(hasPrevious || hasNext || rosterTotal > 0) && (
                  <div className="px-4 pb-3">
                    <TablePagination
                      page={listPage}
                      count={rosterPage.length}
                      pageSize={ROSTER_PAGE_SIZE}
                      totalItems={rosterTotal}
                      hasNext={hasNext}
                      loading={rosterLoading}
                      onPrevious={goPrevious}
                      onNext={goNext}
                    />
                  </div>
                )}
              </Card>
            )}
        </RosterScopeLayout>
      ) : (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes with registered students"
          description="Complete term registration for learners in a class to see them here."
        />
      )}
    </div>
  );
}
