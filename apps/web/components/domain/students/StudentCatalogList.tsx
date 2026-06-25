"use client";

import { useMemo } from "react";
import { SettingsEmptyState } from "@/components/layout/settingsUi";
import type { ClassOut, StudentOut } from "@/lib/types";
import { StudentRow } from "./StudentRow";

interface StudentCatalogListProps {
  students: StudentOut[];
  classes: ClassOut[];
  search: string;
  classFilter: string;
}

export function StudentCatalogList({
  students,
  classes,
  search,
  classFilter,
}: StudentCatalogListProps) {
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => classFilter === "all" || s.class_id === classFilter)
      .filter(
        (s) =>
          !q ||
          s.student_number.includes(q) ||
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          (s.lin ?? "").toLowerCase().includes(q),
      );
  }, [students, search, classFilter]);

  if (items.length === 0) {
    const q = search.trim();
    if (q) return <SettingsEmptyState message={`No students match “${q}”.`} />;
    if (classFilter !== "all") return <SettingsEmptyState message="No students in this class." />;
    return null;
  }

  return (
    <div className="divide-y divide-slate-50 rounded-md border border-slate-100">
      {items.map((student) => (
        <StudentRow key={student.id} student={student} classes={classes} />
      ))}
    </div>
  );
}
