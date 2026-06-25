"use client";

import { SettingsEmptyState } from "@/components/layout/settingsUi";
import { Table, TBody, TD, TH, THead, TR, SkeletonRows } from "@/components/ui/Table";
import type { StudentOut } from "@/lib/types";

function formatGender(gender?: string | null): string {
  if (!gender) return "—";
  return gender === "male" ? "M" : gender === "female" ? "F" : gender;
}

interface StudentRosterTableProps {
  students: StudentOut[];
  isLoading: boolean;
  selectedId?: string | null;
  onSelect: (student: StudentOut) => void;
  emptyMessage: string;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (studentId: string) => void;
  onToggleAll?: (studentIds: string[], select: boolean) => void;
}

export function StudentRosterTable({
  students,
  isLoading,
  selectedId,
  onSelect,
  emptyMessage,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
}: StudentRosterTableProps) {
  if (isLoading) {
    return (
      <Table>
        <THead>
          <tr>
            {selectable && <TH className="w-8" />}
            <TH>Number</TH>
            <TH>Name</TH>
            <TH>LIN</TH>
            <TH>Gender</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <TBody>
          <SkeletonRows cols={selectable ? 6 : 5} rows={6} />
        </TBody>
      </Table>
    );
  }

  if (students.length === 0) {
    return <SettingsEmptyState message={emptyMessage} />;
  }

  const allSelected =
    students.length > 0 && students.every((s) => selectedIds.includes(s.id));

  return (
    <Table>
      <THead>
        <tr>
          {selectable && (
            <TH className="w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) =>
                  onToggleAll?.(
                    students.map((s) => s.id),
                    e.target.checked,
                  )
                }
                className="rounded border-slate-300"
                aria-label="Select all"
              />
            </TH>
          )}
          <TH>Number</TH>
          <TH>Name</TH>
          <TH className="hidden sm:table-cell">LIN</TH>
          <TH className="hidden md:table-cell">Gender</TH>
          <TH>Status</TH>
        </tr>
      </THead>
      <TBody>
        {students.map((student) => {
          const fullName = `${student.first_name} ${student.last_name}`;
          const active = selectedId === student.id;
          const checked = selectedIds.includes(student.id);
          return (
            <TR
              key={student.id}
              onClick={() => onSelect(student)}
            >
              {selectable && (
                <TD className="w-8">
                  <span
                    role="presentation"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect?.(student.id)}
                      className="rounded border-slate-300"
                      aria-label={`Select ${fullName}`}
                    />
                  </span>
                </TD>
              )}
              <TD className="font-mono text-[11px] text-slate-400">{student.student_number}</TD>
              <TD className={active ? "font-medium text-brand-800" : undefined}>{fullName}</TD>
              <TD className="hidden text-slate-400 sm:table-cell">{student.lin ?? "—"}</TD>
              <TD className="hidden md:table-cell">{formatGender(student.gender)}</TD>
              <TD>
                <span
                  className={
                    student.is_active ? "text-slate-600" : "text-slate-300"
                  }
                >
                  {student.is_active ? "Active" : "Inactive"}
                </span>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
