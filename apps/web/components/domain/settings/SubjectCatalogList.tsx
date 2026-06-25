"use client";

import { useMemo } from "react";
import { SettingsEmptyState } from "@/components/layout/settingsUi";
import { subjectHasCycle } from "@/lib/subjectCycleUtils";
import type { NcdcCycle, SubjectOut } from "@/lib/types";
import { SubjectRow } from "./SubjectRow";

interface SubjectCatalogListProps {
  subjects: SubjectOut[];
  search: string;
  cycleFilter: "all" | NcdcCycle;
}

export function SubjectCatalogList({
  subjects,
  search,
  cycleFilter,
}: SubjectCatalogListProps) {
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects
      .filter((s) => cycleFilter === "all" || subjectHasCycle(s, cycleFilter))
      .filter(
        (s) =>
          !q ||
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [subjects, search, cycleFilter]);

  if (items.length === 0) {
    const q = search.trim();
    if (q) {
      return <SettingsEmptyState message={`No subjects match “${q}”.`} />;
    }
    if (cycleFilter !== "all") {
      return <SettingsEmptyState message="No subjects in this cycle yet." />;
    }
    return null;
  }

  return (
    <div>
      {items.map((subject) => (
        <SubjectRow key={subject.id} subject={subject} />
      ))}
    </div>
  );
}
