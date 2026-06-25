"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import {
  SettingsFilterPills,
  SettingsHint,
  SettingsStatRow,
} from "@/components/layout/settingsUi";
import { parseError } from "@/lib/apiError";
import { NCDC_CYCLE_LABELS, type NcdcSubjectSuggestion } from "@/lib/ncdcSubjectCatalog";
import { formatCycleLabels, subjectByCode, subjectHasCycle } from "@/lib/subjectCycleUtils";
import type { NcdcCycle } from "@/lib/types";
import {
  useCreateSubjectMutation,
  useListSubjectsQuery,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { SubjectAddPanel } from "./SubjectAddPanel";
import { SubjectCatalogList } from "./SubjectCatalogList";

const CYCLE_FILTERS: { id: "all" | NcdcCycle; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cycle_1", label: "P1–P3" },
  { id: "cycle_2", label: "P4" },
  { id: "cycle_3", label: "P5–P7" },
];

const CORE_PREFIXES = ["ENG", "MTC", "MATH", "SCI", "SST", "SOCIAL"];

function defaultIsCoreForCatalog(code: string, ple?: boolean): boolean {
  if (ple) return true;
  const normalized = code.replace(/\s/g, "").toUpperCase();
  return CORE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function SubjectCatalogView() {
  const { toast } = useToast();
  const { data: subjects, isLoading, isError, refetch, isFetching } = useListSubjectsQuery();
  const [createSubject, { isLoading: creating }] = useCreateSubjectMutation();
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<"all" | NcdcCycle>("all");
  const [addOpen, setAddOpen] = useState(false);

  const list = subjects ?? [];
  const total = list.length;

  useEffect(() => {
    if (total === 0) setAddOpen(true);
  }, [total]);

  const cycleCounts = useMemo(
    () =>
      (["cycle_1", "cycle_2", "cycle_3"] as NcdcCycle[]).map((cycle) => ({
        label: NCDC_CYCLE_LABELS[cycle].short,
        value: list.filter((s) => subjectHasCycle(s, cycle)).length,
      })),
    [list],
  );

  async function addSubject(payload: {
    code: string;
    name: string;
    cycle: NcdcCycle;
    is_core?: boolean;
  }) {
    const existing = subjectByCode(list, payload.code);
    const extending =
      existing !== undefined && !subjectHasCycle(existing, payload.cycle);
    try {
      const result = await createSubject({
        code: payload.code,
        name: payload.name,
        ncdc_cycle: payload.cycle,
        is_core: payload.is_core,
      }).unwrap();
      toast(
        extending
          ? `${result.code} added to ${NCDC_CYCLE_LABELS[payload.cycle].short}. Now ${formatCycleLabels(result.ncdc_cycles)}.`
          : `${result.code} added.`,
        "success",
      );
      if (total > 0) setAddOpen(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
      throw err;
    }
  }

  async function bulkAdd(items: NcdcSubjectSuggestion[]) {
    let touched = 0;
    for (const item of items) {
      try {
        await createSubject({
          code: item.code,
          name: item.name,
          ncdc_cycle: item.cycle,
          is_core: defaultIsCoreForCatalog(item.code, item.ple),
        }).unwrap();
        touched += 1;
      } catch (err) {
        const p = parseError(err);
        toast(p.message, "error", p.requestId);
        break;
      }
    }
    if (touched > 0) {
      toast(`${touched} update${touched === 1 ? "" : "s"} applied.`, "success");
      setAddOpen(false);
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load subjects." />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {total > 0 ? (
          <SettingsStatRow items={[{ label: "Codes", value: total }, ...cycleCounts]} />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {total > 0 && (
            <div className="relative">
              <Icon
                name="search"
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subjects…"
                className="w-44 pl-8"
                aria-label="Search subjects"
              />
            </div>
          )}
          {!addOpen && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={13} />
              Add subjects
            </Button>
          )}
          <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh subjects" />
        </div>
      </div>

      {addOpen && (
        <Card>
          <CardHeader
            icon={<Icon name="book" size={13} />}
            title="Add subjects"
            description="Pick from the NCDC list or enter codes manually."
            action={
              total > 0 ? (
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <Icon name="x" size={15} />
                </button>
              ) : undefined
            }
          />
          <CardBody>
            <SubjectAddPanel
              subjects={list}
              creating={creating}
              onAdd={addSubject}
              onBulkAdd={bulkAdd}
              onClose={total > 0 ? () => setAddOpen(false) : undefined}
            />
          </CardBody>
        </Card>
      )}

      {total > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <SettingsFilterPills
              options={CYCLE_FILTERS}
              active={cycleFilter}
              onChange={(id) => setCycleFilter(id as "all" | NcdcCycle)}
            />
            <SettingsHint>One code can span multiple cycles.</SettingsHint>
          </div>
          <div className="px-1.5 py-1.5">
            <SubjectCatalogList subjects={list} search={search} cycleFilter={cycleFilter} />
          </div>
        </Card>
      ) : !addOpen ? (
        <EmptyState
          icon={<Icon name="book" size={18} />}
          title="No subjects yet"
          description="Build your catalogue from the NCDC list or enter codes manually."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={13} />
              Add subjects
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
