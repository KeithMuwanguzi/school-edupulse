"use client";

import { SettingsEmptyState } from "@/components/layout/settingsUi";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR, SkeletonRows } from "@/components/ui/Table";
import type { StudentOut } from "@/lib/types";
import { formatStudentFullName } from "./studentOptions";

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

function StudentMobileCard({
  student,
  active,
  selectable,
  checked,
  onSelect,
  onToggleSelect,
}: {
  student: StudentOut;
  active: boolean;
  selectable: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleSelect?: () => void;
}) {
  const fullName = formatStudentFullName(student);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/20 active:bg-brand-50/40"
    >
      {selectable && (
        <span
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleSelect?.()}
            className="mt-0.5 rounded border-slate-300"
            aria-label={`Select ${fullName}`}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] ${active ? "font-semibold text-brand-800" : "font-medium text-slate-800"}`}>
          {fullName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{student.student_number}</p>
        <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
          {student.lin && <span>LIN {student.lin}</span>}
          {student.gender && <span>{formatGender(student.gender)}</span>}
          <span className={student.is_active ? "text-slate-600" : "text-slate-300"}>
            {student.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </button>
  );
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
      <>
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="hidden md:block">
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
        </div>
      </>
    );
  }

  if (students.length === 0) {
    return <SettingsEmptyState message={emptyMessage} />;
  }

  const allSelected =
    students.length > 0 && students.every((s) => selectedIds.includes(s.id));

  return (
    <>
      {selectable && (
        <label className="mb-2 flex items-center gap-2 px-1 text-[11px] text-slate-500 md:hidden">
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
          />
          Select all
        </label>
      )}

      <div className="space-y-2 md:hidden">
        {students.map((student) => (
          <StudentMobileCard
            key={student.id}
            student={student}
            active={selectedId === student.id}
            selectable={selectable}
            checked={selectedIds.includes(student.id)}
            onSelect={() => onSelect(student)}
            onToggleSelect={() => onToggleSelect?.(student.id)}
          />
        ))}
      </div>

      <div className="hidden md:block">
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
              const fullName = formatStudentFullName(student);
              const active = selectedId === student.id;
              const checked = selectedIds.includes(student.id);
              return (
                <TR key={student.id} onClick={() => onSelect(student)}>
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
                    <span className={student.is_active ? "text-slate-600" : "text-slate-300"}>
                      {student.is_active ? "Active" : "Inactive"}
                    </span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
