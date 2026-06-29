"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsFilterPills, SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { exportRegistrationQueueExcel } from "@/lib/rosterExport";
import { fetchRegistrationQueue } from "@/lib/rosterExportFetch";
import type { RosterScope } from "@/lib/types";
import {
  useAcademicContextQuery,
  useRegistrationQueueQuery,
  useRegistrationSummaryQuery,
  useRosterSummaryQuery,
  useStartRegistrationMutation,
} from "@/store/api/skulpulseApi";
import type { RootState } from "@/store";
import { useSelector } from "react-redux";
import { useToast } from "@/components/ui/Toast";
import { TablePagination } from "@/components/ui/TablePagination";
import { useClientPageSlice } from "@/hooks/useClientPageSlice";
import { compareStudentFullName, ROSTER_PAGE_SIZE } from "@/lib/rosterConstants";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { ClassStreamPicker } from "./ClassStreamPicker";
import { RosterScopeLayout } from "./RosterScopeLayout";
import { formatStudentFullName } from "./studentOptions";
import {
  defaultRegistrationScope,
  exportScopeToApiParams,
  registrationScopeToQueueParams,
  scopeLabel,
} from "./rosterScope";
import { RosterExportButton } from "./RosterExportButton";

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "not_started", label: "Not started" },
  { id: "in_progress", label: "In progress" },
  { id: "complete", label: "Complete" },
];

function statusTone(status: string): "neutral" | "gold" | "green" {
  if (status === "complete") return "green";
  if (status === "in_progress") return "gold";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "complete") return "Complete";
  return status;
}

export function TermRegistrationQueueView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { data: academic, refetch: refetchAcademic, isFetching: fetchingAcademic } =
    useAcademicContextQuery();
  const {
    data: rosterSummary,
    isLoading: rosterLoading,
    isError: rosterError,
    refetch: refetchRosterSummary,
    isFetching: fetchingRosterSummary,
  } = useRosterSummaryQuery();
  const [scope, setScope] = useState<RosterScope | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startRegistration] = useStartRegistrationMutation();

  useEffect(() => {
    if (scope === null && rosterSummary) {
      setScope(defaultRegistrationScope(rosterSummary));
    }
  }, [rosterSummary, scope]);

  const queueParams = useMemo(() => {
    if (!scope || scope.kind === "overview") return undefined;
    return registrationScopeToQueueParams(scope, query, statusFilter);
  }, [scope, query, statusFilter]);

  const termLabel = academic?.active_term?.label ?? "Active term";
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary, isFetching: fetchingSummary } =
    useRegistrationSummaryQuery();
  const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue, isFetching: fetchingQueue } =
    useRegistrationQueueQuery(queueParams, {
    skip: !queueParams,
  });

  const paginationResetKey = useMemo(() => {
    if (!scope) return "none";
    if (scope.kind === "unassigned") return `unassigned:${statusFilter}:${query}`;
    if (scope.kind === "class") return `class:${scope.classId}:${statusFilter}:${query}`;
    if (scope.kind === "stream") {
      return `stream:${scope.classId}:${scope.streamId}:${statusFilter}:${query}`;
    }
    return "overview";
  }, [scope, statusFilter, query]);

  const sortedQueue = useMemo(
    () => [...queue].sort(compareStudentFullName),
    [queue],
  );

  const {
    page: listPage,
    pageItems: queuePage,
    total: queueTotal,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
  } = useClientPageSlice(sortedQueue, paginationResetKey);

  const isRefreshing =
    fetchingAcademic || fetchingRosterSummary || fetchingSummary || fetchingQueue;

  async function refreshAll() {
    await refreshQueries(refetchAcademic, refetchRosterSummary, refetchSummary, refetchQueue);
  }

  const stats = useMemo(
    () =>
      summary
        ? [
            { label: "Enrolled", value: summary.total_students },
            { label: "Not started", value: summary.not_started },
            { label: "In progress", value: summary.in_progress },
            { label: "Complete", value: summary.complete },
          ]
        : [],
    [summary],
  );

  const rosterTitle = scope ? scopeLabel(scope, rosterSummary) : "Select a class";

  async function handleExport() {
    if (!scope || !rosterSummary) return;
    const filters = exportScopeToApiParams(scope, query);
    if (!filters) return;
    try {
      const rows = await fetchRegistrationQueue(accessToken, {
        ...filters,
        status: statusFilter || undefined,
      });
      if (!rows.length) {
        toast("No pupils match the current filters.", "error");
        return;
      }
      exportRegistrationQueueExcel(rows, scopeLabel(scope, rosterSummary));
      toast(`Exported ${rows.length} pupil(s) to Excel.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message || "Export failed.", "error", p.requestId);
    }
  }

  async function openRegistration(
    studentId: string,
    registrationId?: string | null,
  ) {
    setStartingId(studentId);
    try {
      if (registrationId) {
        router.push(`/app/m/students/registration/${registrationId}`);
        return;
      }
      const created = await startRegistration({ student_id: studentId }).unwrap();
      router.push(`/app/m/students/registration/${created.id}`);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    } finally {
      setStartingId(null);
    }
  }

  if (summaryLoading || rosterLoading) return <PageLoader />;

  if (rosterError || summaryError) {
    return <ErrorBanner message="Couldn't load the registration queue. Please refresh and try again." />;
  }

  if (!rosterSummary || rosterSummary.total === 0) {
    return (
      <EmptyState
        icon={<Icon name="graduation" size={18} />}
        title="No students enrolled yet"
        description="Onboard students first, then return here to register them for the term."
      />
    );
  }

  return (
    <div className="space-y-4">
      {embedded ? (
        <div className="space-y-3">
          <SettingsStatRow items={stats} />
          <PageToolbar>
            <PageToolbarGroup className="w-full sm:flex-1">
              <div className="relative w-full sm:max-w-xs">
                <Icon
                  name="search"
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search in this roster…"
                  className="h-9 w-full pl-8 text-[13px] sm:h-7 sm:text-[12px]"
                  disabled={!scope || scope.kind === "overview"}
                />
              </div>
              <SettingsFilterPills
                options={STATUS_FILTERS}
                active={statusFilter}
                onChange={setStatusFilter}
              />
            </PageToolbarGroup>
            <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh queue" />
          </PageToolbar>
        </div>
      ) : (
        <Card>
          <CardHeader
            title="Term registration"
            description={`Receive returning learners for ${termLabel}. Pick a class or stream, then register learners one by one.`}
            action={<RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh registration queue" />}
          />
          <CardBody className="space-y-3 py-3">
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
              <SettingsFilterPills
                options={STATUS_FILTERS}
                active={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {scope ? (
        <RosterScopeLayout
          picker={
            <ClassStreamPicker
              summary={rosterSummary}
              scope={scope}
              registrationMode
              onChange={setScope}
            />
          }
        >
          {queueLoading ? (
              <PageLoader />
            ) : sortedQueue.length === 0 ? (
              <EmptyState
                icon={<Icon name="clipboard" size={18} />}
                title="No learners in this roster"
                description="Try another class or stream, or adjust your status filter."
              />
            ) : (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                  <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                    {rosterTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      <span className="font-medium tabular-nums text-slate-600">{sortedQueue.length}</span>{" "}
                      in roster
                    </span>
                    <RosterExportButton onExport={handleExport} />
                  </div>
                </div>

                <div className="space-y-2 p-3 md:hidden">
                  {queuePage.map((row) => {
                    const pct =
                      row.required_total > 0
                        ? Math.round((row.required_done / row.required_total) * 100)
                        : 0;
                    return (
                      <div
                        key={row.student_id}
                        className="rounded-lg border border-slate-200/80 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {formatStudentFullName(row)}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">{row.student_number}</p>
                          </div>
                          <Badge tone={statusTone(row.status)} dot>
                            {statusLabel(row.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                pct === 100 ? "bg-brand-600" : "bg-gold-500",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {row.sections_complete}/{row.sections_total}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={row.status === "complete" ? "ghost" : "secondary"}
                          loading={startingId === row.student_id}
                          className="mt-3 w-full"
                          onClick={() => void openRegistration(row.student_id, row.registration_id)}
                        >
                          {row.status === "not_started"
                            ? "Start check-in"
                            : row.status === "complete"
                              ? "View"
                              : "Continue check-in"}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Progress</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queuePage.map((row) => {
                        const pct =
                          row.required_total > 0
                            ? Math.round((row.required_done / row.required_total) * 100)
                            : 0;
                        return (
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
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      pct === 100 ? "bg-brand-600" : "bg-gold-500",
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {row.sections_complete}/{row.sections_total} sections
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge tone={statusTone(row.status)} dot>
                                {statusLabel(row.status)}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Button
                                size="sm"
                                variant={row.status === "complete" ? "ghost" : "secondary"}
                                loading={startingId === row.student_id}
                                onClick={() =>
                                  void openRegistration(row.student_id, row.registration_id)
                                }
                              >
                                {row.status === "not_started"
                                  ? "Start"
                                  : row.status === "complete"
                                    ? "View"
                                    : "Continue"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(hasPrevious || hasNext || queueTotal > 0) && (
                  <div className="px-4 pb-3">
                    <TablePagination
                      page={listPage}
                      count={queuePage.length}
                      pageSize={ROSTER_PAGE_SIZE}
                      totalItems={queueTotal}
                      hasNext={hasNext}
                      loading={queueLoading}
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
          title="No classes with students"
          description="Assign learners to classes, then register them here term by term."
        />
      )}
    </div>
  );
}
