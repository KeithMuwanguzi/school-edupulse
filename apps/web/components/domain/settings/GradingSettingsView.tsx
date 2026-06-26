"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { SettingsFilterPills, SettingsHint } from "@/components/layout/settingsUi";
import { GradingAggregatePanel } from "@/components/domain/settings/grading/GradingAggregatePanel";
import { GradingCyclePanel } from "@/components/domain/settings/grading/GradingCyclePanel";
import { useGetGradingConfigQuery } from "@/store/api/skulpulseApi";

const AGGREGATE_TAB = "aggregate";
const PRIMARY_TABS = ["cycle_1", "cycle_2", "cycle_3"] as const;

export function GradingSettingsView() {
  const { data, isLoading, isError, refetch, isFetching } = useGetGradingConfigQuery();
  const [activeCycle, setActiveCycle] = useState<string | null>(null);

  const primarySections = useMemo(
    () => (data?.sections ?? []).filter((s) => PRIMARY_TABS.includes(s.cycle as (typeof PRIMARY_TABS)[number])),
    [data?.sections],
  );

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <ErrorBanner message="Couldn't load grading configuration. Please refresh and try again." />
    );
  }

  const totalInPrimary = primarySections.reduce((n, s) => n + s.subjects.length, 0);
  const cycleTabs = [
    ...primarySections.map((s) => ({
      id: s.cycle,
      label: s.cycle_label,
    })),
    { id: AGGREGATE_TAB, label: "Aggregate" },
  ];
  const resolvedCycle = activeCycle ?? primarySections[0]?.cycle ?? AGGREGATE_TAB;
  const activeSection = primarySections.find((s) => s.cycle === resolvedCycle);

  return (
    <div className="space-y-4">
      <PageToolbar className="items-start">
        <SettingsHint>
          Grade bands use short descriptors (Excellent, Good, etc.) for subject rows. Class teacher and head teacher
          remarks for the full report card are configured on the Aggregate tab.
        </SettingsHint>
        <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh grading" />
      </PageToolbar>

      {totalInPrimary > 0 && (
        <SettingsFilterPills
          options={cycleTabs}
          active={resolvedCycle}
          onChange={(id) => setActiveCycle(id)}
        />
      )}

      {totalInPrimary === 0 ? (
        <EmptyState
          icon={<Icon name="chart" size={18} />}
          title="Add subjects first"
          description="Create subjects under Settings → Subjects for P1–P3, P4, or P5–P7. They will appear here for grading setup."
          action={
            <Link href="/app/settings/subjects">
              <Button size="sm">Go to subjects</Button>
            </Link>
          }
        />
      ) : resolvedCycle === AGGREGATE_TAB ? (
        <GradingAggregatePanel divisions={data.aggregate_divisions} />
      ) : activeSection ? (
        <GradingCyclePanel section={activeSection} />
      ) : null}
    </div>
  );
}
