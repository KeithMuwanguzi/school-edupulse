"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { useAppSelector } from "@/store/hooks";
import { useListDisciplineSchoolWideQuery } from "@/store/api/skulpulseApi";
import {
  DISCIPLINE_STATUS_OPTIONS,
  disciplineStatusTone,
  severityTone,
  titleCase,
} from "./studentOptions";

export function StudentDisciplineView() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const subscribed = user?.modules.includes("students") ?? false;
  const [status, setStatus] = useState("");
  const { data: records = [], isLoading, isError, refetch, isFetching } = useListDisciplineSchoolWideQuery(
    status ? { status } : undefined,
    { skip: !subscribed },
  );

  if (!user) return <PageLoader />;
  if (!subscribed) {
    return (
      <EmptyState
        icon={<Icon name="shield" size={18} />}
        title="Students module not enabled"
        description="Contact SkulPulse to add the Students module to your subscription."
      />
    );
  }

  const openCount = records.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-4">
      <PageToolbar className="sm:justify-between">
        <SettingsStatRow
          items={[
            { label: "Incidents", value: records.length },
            { label: "Open", value: openCount },
          ]}
        />
        <PageToolbarGroup>
          <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh incidents" />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 w-full text-[12px] sm:h-7 sm:w-36"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {DISCIPLINE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </PageToolbarGroup>
      </PageToolbar>

      {isLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading incidents…</Card>
      ) : isError ? (
        <ErrorBanner message="Couldn't load discipline incidents. Please refresh and try again." />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Icon name="shield" size={18} />}
          title="No incidents logged"
          description="Discipline incidents recorded on a student's profile appear here."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {records.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => router.push(`/app/m/students/${r.student_id}`)}
              className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-slate-800">
                    {r.student_name ?? "Student"}
                  </span>
                  {r.student_number && (
                    <span className="font-mono text-[10px] text-slate-400">{r.student_number}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-slate-600">{r.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-slate-400">{r.incident_date}</span>
                <div className="flex gap-1">
                  {r.severity && (
                    <span className={`rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ring-1 ${severityTone(r.severity)}`}>
                      {r.severity}
                    </span>
                  )}
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ring-1 ${disciplineStatusTone(r.status)}`}>
                    {titleCase(r.status)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
