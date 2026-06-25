"use client";

import { useMemo, useState } from "react";
import {
  SettingsEmptyState,
  SettingsFilterPills,
  SettingsStatRow,
} from "@/components/layout/settingsUi";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { useListClassesQuery, useListStudentsQuery } from "@/store/api/skulpulseApi";
import { StudentCatalogList } from "./StudentCatalogList";

interface StudentDirectorySectionProps {
  onEnroll: () => void;
  isAdmin: boolean;
}

export function StudentDirectorySection({ onEnroll, isAdmin }: StudentDirectorySectionProps) {
  const { data: page, isLoading, isError } = useListStudentsQuery({ limit: 100 });
  const { data: classes = [] } = useListClassesQuery();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const students = page?.items ?? [];
  const activeCount = students.filter((s) => s.is_active).length;
  const assignedCount = students.filter((s) => s.class_id).length;

  const classFilters = useMemo(
    () => [
      { id: "all", label: "All" },
      ...classes.map((c) => ({ id: c.id, label: c.level })),
    ],
    [classes],
  );

  return (
    <Card>
      <CardHeader
        title="Students"
        description="Enrolled learners P1–P7."
        action={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {students.length > 0 && (
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-7 w-36 text-[12px]"
                aria-label="Search students"
              />
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={onEnroll}
                className="text-[11px] font-medium text-brand-700 hover:text-brand-800"
              >
                Enroll student
              </button>
            )}
          </div>
        }
      />
      <CardBody className="space-y-3 py-3">
        {isLoading ? (
          <p className="text-[12px] text-slate-400">Loading…</p>
        ) : isError ? (
          <ErrorBanner message="Couldn't load the student roster. Please refresh and try again." />
        ) : students.length > 0 ? (
          <>
            <SettingsStatRow
              items={[
                { label: "Enrolled", value: students.length },
                { label: "In class", value: assignedCount },
                { label: "Active", value: activeCount },
              ]}
            />
            {classFilters.length > 1 && (
              <SettingsFilterPills
                options={classFilters}
                active={classFilter}
                onChange={setClassFilter}
              />
            )}
            <StudentCatalogList
              students={students}
              classes={classes}
              search={query}
              classFilter={classFilter}
            />
            {page?.has_more && (
              <p className="text-[10px] text-slate-400">
                Showing first {students.length} students — use search to narrow results.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <SettingsEmptyState message="No students enrolled yet." />
            {isAdmin && (
              <button
                type="button"
                onClick={onEnroll}
                className="text-[11px] font-medium text-brand-700 hover:text-brand-800"
              >
                Enroll your first student
              </button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
