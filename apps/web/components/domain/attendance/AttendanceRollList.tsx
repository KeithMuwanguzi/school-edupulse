"use client";

import { cn } from "@/lib/cn";
import type { AttendanceStatus } from "@/lib/types";

const STATUS_OPTIONS: { id: AttendanceStatus; label: string; short: string }[] = [
  { id: "present", label: "Present", short: "P" },
  { id: "absent", label: "Absent", short: "A" },
  { id: "late", label: "Late", short: "L" },
  { id: "excused", label: "Excused", short: "E" },
];

export interface LocalRollRow {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  status: AttendanceStatus;
  remarks: string;
  term_rate?: number | null;
}

interface AttendanceRollListProps {
  rows: LocalRollRow[];
  canEdit: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onRemarksChange: (studentId: string, remarks: string) => void;
}

function statusButtonClass(status: AttendanceStatus, active: boolean): string {
  if (!active) {
    return "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700";
  }
  switch (status) {
    case "present":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "absent":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    case "late":
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    default:
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
  }
}

function RollMobileCard({
  row,
  canEdit,
  onStatusChange,
  onRemarksChange,
}: {
  row: LocalRollRow;
  canEdit: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onRemarksChange: (studentId: string, remarks: string) => void;
}) {
  const fullName = `${row.first_name} ${row.last_name}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-slate-900">{fullName}</p>
          <p className="font-mono text-[10px] text-slate-400">{row.student_number}</p>
        </div>
        {row.term_rate != null && (
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
            Term {row.term_rate}%
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={!canEdit}
            title={opt.label}
            onClick={() => onStatusChange(row.student_id, opt.id)}
            className={cn(
              "flex h-10 items-center justify-center rounded-md text-[12px] font-semibold transition",
              statusButtonClass(opt.id, row.status === opt.id),
              !canEdit && "cursor-default opacity-70",
            )}
          >
            {opt.short}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {canEdit ? (
          <input
            value={row.remarks}
            onChange={(e) => onRemarksChange(row.student_id, e.target.value)}
            placeholder="Remarks (optional)"
            className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-[12px] text-slate-700 focus-visible:border-brand-400 focus-visible:outline-none"
          />
        ) : row.remarks ? (
          <p className="text-[11px] text-slate-500">{row.remarks}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AttendanceRollList({
  rows,
  canEdit,
  onStatusChange,
  onRemarksChange,
}: AttendanceRollListProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-[12px] text-slate-400">No students in this class roster.</p>;
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <RollMobileCard
            key={row.student_id}
            row={row}
            canEdit={canEdit}
            onStatusChange={onStatusChange}
            onRemarksChange={onRemarksChange}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-card md:block">
        <table className="min-w-full divide-y divide-slate-100 text-[12px]">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Student
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Status
              </th>
              <th className="hidden px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:table-cell">
                Term %
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const fullName = `${row.first_name} ${row.last_name}`;
              return (
                <tr key={row.student_id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-slate-700">{fullName}</span>
                    <span className="font-mono text-[10px] text-slate-400">{row.student_number}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!canEdit}
                          title={opt.label}
                          onClick={() => onStatusChange(row.student_id, opt.id)}
                          className={cn(
                            "h-7 min-w-[2rem] rounded px-1.5 text-[10px] font-medium transition",
                            statusButtonClass(opt.id, row.status === opt.id),
                            !canEdit && "cursor-default opacity-70",
                          )}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 tabular-nums text-slate-500 sm:table-cell">
                    {row.term_rate != null ? `${row.term_rate}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        value={row.remarks}
                        onChange={(e) => onRemarksChange(row.student_id, e.target.value)}
                        placeholder="Optional"
                        className="h-7 w-full max-w-[10rem] rounded border border-slate-200 px-2 text-[11px] text-slate-700 focus-visible:border-brand-400 focus-visible:outline-none"
                      />
                    ) : (
                      <span className="text-slate-400">{row.remarks || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
