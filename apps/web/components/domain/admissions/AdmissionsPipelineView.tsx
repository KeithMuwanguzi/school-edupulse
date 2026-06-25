"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import type { AdmissionApplicationOut } from "@/lib/types";
import {
  useListAdmissionApplicationsQuery,
  useUpdateAdmissionApplicationMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import {
  ADMISSION_NEXT_STATUS,
  ADMISSION_PIPELINE_STATUSES,
  formatAppliedClass,
  withdrawalReasonLabel,
} from "./admissionOptions";
import { WithdrawApplicationPanel } from "./WithdrawApplicationPanel";

type ViewMode = "pipeline" | "archive";

interface AdmissionsPipelineViewProps {
  isAdmin: boolean;
}

function PipelineCard({
  app,
  isAdmin,
  onAdvance,
  onWithdraw,
  advancing,
}: {
  app: AdmissionApplicationOut;
  isAdmin: boolean;
  onAdvance: (id: string, status: string) => void;
  onWithdraw: (app: AdmissionApplicationOut) => void;
  advancing: boolean;
}) {
  const next = ADMISSION_NEXT_STATUS[app.status];
  const canEnroll = app.status === "accepted" && isAdmin;
  const canWithdraw = isAdmin && app.status !== "enrolled";

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-sm">
      <p className="font-medium text-[12px] text-slate-800">
        {app.first_name} {app.last_name}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{app.reference_number}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        {formatAppliedClass(app.applied_class_level, app.applied_class_label, app.applied_stream_name)}
      </p>
      {app.interview_score != null && (
        <p className="mt-1 text-[10px] text-brand-700">Score: {app.interview_score}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {canEnroll && (
          <Link
            href={`/app/m/admissions/enroll/${app.id}`}
            className="inline-flex items-center rounded-md bg-brand-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-brand-700"
          >
            Enroll
          </Link>
        )}
        {app.status === "enrolled" && app.student_id && (
          <Link
            href={`/app/m/students/${app.student_id}`}
            className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            View student
          </Link>
        )}
        {next && isAdmin && (
          <button
            type="button"
            disabled={advancing}
            onClick={() => onAdvance(app.id, next)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Move to {ADMISSION_PIPELINE_STATUSES.find((s) => s.key === next)?.label}
          </button>
        )}
        {canWithdraw && (
          <button
            type="button"
            disabled={advancing}
            onClick={() => onWithdraw(app)}
            className="rounded-md border border-amber-200 px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

function ArchiveCard({
  app,
  isAdmin,
  onReopen,
  advancing,
}: {
  app: AdmissionApplicationOut;
  isAdmin: boolean;
  onReopen: (id: string) => void;
  advancing: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium text-[12px] text-slate-800">
            {app.first_name} {app.last_name}
          </p>
          <Badge tone="neutral">{withdrawalReasonLabel(app.withdrawal_reason)}</Badge>
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{app.reference_number}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {formatAppliedClass(app.applied_class_level, app.applied_class_label, app.applied_stream_name)}
        </p>
        {app.withdrawal_note && (
          <p className="mt-1 text-[10px] text-slate-500">{app.withdrawal_note}</p>
        )}
      </div>
      {isAdmin && (
        <Button
          size="sm"
          variant="ghost"
          loading={advancing}
          onClick={() => onReopen(app.id)}
          className="shrink-0"
        >
          Reopen
        </Button>
      )}
    </div>
  );
}

export function AdmissionsPipelineView({ isAdmin }: AdmissionsPipelineViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("pipeline");
  const [withdrawingApp, setWithdrawingApp] = useState<AdmissionApplicationOut | null>(null);
  const { data: applications = [], isLoading, isError, refetch, isFetching } =
    useListAdmissionApplicationsQuery();
  const [updateApplication, { isLoading: updating }] = useUpdateAdmissionApplicationMutation();

  const activeApplications = useMemo(
    () => applications.filter((a) => a.status !== "withdrawn"),
    [applications],
  );

  const archivedApplications = useMemo(
    () => applications.filter((a) => a.status === "withdrawn"),
    [applications],
  );

  const grouped = useMemo(() => {
    const map: Record<string, AdmissionApplicationOut[]> = {};
    for (const status of ADMISSION_PIPELINE_STATUSES) {
      map[status.key] = [];
    }
    for (const app of activeApplications) {
      if (map[app.status]) map[app.status].push(app);
    }
    return map;
  }, [activeApplications]);

  const stats = useMemo(
    () =>
      ADMISSION_PIPELINE_STATUSES.map((s) => ({
        label: s.label,
        value: grouped[s.key]?.length ?? 0,
      })),
    [grouped],
  );

  async function advance(applicationId: string, status: string) {
    try {
      await updateApplication({ applicationId, body: { status } }).unwrap();
      toast("Application updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function withdraw(
    applicationId: string,
    payload: { withdrawal_reason: string; withdrawal_note?: string },
  ) {
    if (payload.withdrawal_reason === "other" && !payload.withdrawal_note?.trim()) {
      toast("Add a note when the reason is Other.", "error");
      return;
    }
    try {
      await updateApplication({
        applicationId,
        body: {
          status: "withdrawn",
          withdrawal_reason: payload.withdrawal_reason,
          withdrawal_note: payload.withdrawal_note?.trim() || undefined,
        },
      }).unwrap();
      toast("Application moved to archive.", "success");
      setWithdrawingApp(null);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function reopen(applicationId: string) {
    try {
      await updateApplication({
        applicationId,
        body: { status: "application" },
      }).unwrap();
      toast("Application reopened.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("pipeline")}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                view === "pipeline"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Pipeline
            </button>
            <button
              type="button"
              onClick={() => setView("archive")}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                view === "archive"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Archive
              {archivedApplications.length > 0 && (
                <span className="ml-1 tabular-nums opacity-80">({archivedApplications.length})</span>
              )}
            </button>
          </div>
          {view === "pipeline" && <SettingsStatRow items={stats} />}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && view === "pipeline" && (
            <>
              <Button size="sm" variant="secondary" disabled title="Coming soon">
                Public form
              </Button>
              <Button size="sm" onClick={() => router.push("/app/m/admissions/new?mode=multiple")}>
                <Icon name="plus" size={13} />
                Add applicants
              </Button>
            </>
          )}
          <RefreshButton
            onRefresh={refetch}
            isRefreshing={isFetching}
            label="Refresh admissions"
          />
        </div>
      </div>

      {withdrawingApp && isAdmin && (
        <WithdrawApplicationPanel
          application={withdrawingApp}
          loading={updating}
          onConfirm={(payload) => void withdraw(withdrawingApp.id, payload)}
          onCancel={() => setWithdrawingApp(null)}
        />
      )}

      {isLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading…</Card>
      ) : isError ? (
        <ErrorBanner message="Couldn't load admissions applications. Please refresh and try again." />
      ) : view === "archive" ? (
        archivedApplications.length === 0 ? (
          <EmptyState
            icon={<Icon name="inbox" size={18} />}
            title="Archive is empty"
            description="Closed applications — rejected, withdrawn, or no-shows — appear here with their reason."
          />
        ) : (
          <Card className="divide-y divide-slate-100 p-2">
            {archivedApplications.map((app) => (
              <div key={app.id} className="py-1 first:pt-0 last:pb-0">
                <ArchiveCard
                  app={app}
                  isAdmin={isAdmin}
                  onReopen={reopen}
                  advancing={updating}
                />
              </div>
            ))}
          </Card>
        )
      ) : activeApplications.length === 0 ? (
        <EmptyState
          icon={<Icon name="clipboard" size={18} />}
          title="No applications yet"
          description="Record a new application when a family expresses interest in joining the school."
          action={
            isAdmin ? (
              <Button size="sm" onClick={() => router.push("/app/m/admissions/new?mode=multiple")}>
                <Icon name="plus" size={13} />
                Add applicants
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ADMISSION_PIPELINE_STATUSES.map((column) => (
            <Card key={column.key} className="flex min-h-[12rem] flex-col">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <h3 className="text-[12px] font-semibold text-slate-900">
                  {column.label}
                  <span className="ml-1.5 font-normal tabular-nums text-slate-400">
                    ({grouped[column.key]?.length ?? 0})
                  </span>
                </h3>
              </div>
              <div
                className={cn(
                  "flex flex-1 flex-col gap-2 p-2",
                  grouped[column.key]?.length === 0 && "justify-center",
                )}
              >
                {grouped[column.key]?.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-400">Empty</p>
                ) : (
                  grouped[column.key].map((app) => (
                    <PipelineCard
                      key={app.id}
                      app={app}
                      isAdmin={isAdmin}
                      onAdvance={advance}
                      onWithdraw={setWithdrawingApp}
                      advancing={updating}
                    />
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
