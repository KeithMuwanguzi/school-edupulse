import * as XLSX from "xlsx";

import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { compareStudentFullName } from "@/lib/rosterConstants";
import type { RegistrationQueueItemOut, RegisteredStudentOut, StudentOut } from "@/lib/types";

export type ExportCell = string | number | null | undefined;

export interface ExportColumn {
  key: string;
  header: string;
}

export function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned.slice(0, 72) || "roster";
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadWorkbook(rows: ExportCell[][], columns: ExportColumn[], filename: string) {
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((_, i) => row[i] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Roster");
  const file = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, file);
}

function formatGender(gender?: string | null): string {
  if (!gender) return "";
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return gender;
}

function queueStatusLabel(status: string): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "complete") return "Complete";
  return status;
}

function formatRegisteredAt(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const STUDENT_COLUMNS: ExportColumn[] = [
  { key: "student_number", header: "Student number" },
  { key: "full_name", header: "Full name" },
  { key: "last_name", header: "Surname" },
  { key: "middle_name", header: "Middle name" },
  { key: "first_name", header: "Last name" },
  { key: "lin", header: "LIN" },
  { key: "gender", header: "Gender" },
  { key: "class", header: "Class" },
  { key: "stream", header: "Stream" },
  { key: "status", header: "Enrollment status" },
  { key: "active", header: "Active" },
];

const QUEUE_COLUMNS: ExportColumn[] = [
  { key: "student_number", header: "Student number" },
  { key: "full_name", header: "Full name" },
  { key: "last_name", header: "Surname" },
  { key: "middle_name", header: "Middle name" },
  { key: "first_name", header: "Last name" },
  { key: "class", header: "Class" },
  { key: "stream", header: "Stream" },
  { key: "status", header: "Check-in status" },
  { key: "sections", header: "Sections complete" },
  { key: "required", header: "Requirements met" },
];

const REGISTERED_COLUMNS: ExportColumn[] = [
  { key: "student_number", header: "Student number" },
  { key: "full_name", header: "Full name" },
  { key: "last_name", header: "Surname" },
  { key: "middle_name", header: "Middle name" },
  { key: "first_name", header: "Last name" },
  { key: "class", header: "Class" },
  { key: "stream", header: "Stream" },
  { key: "registered_at", header: "Registered" },
];

export function exportStudentRosterExcel(students: StudentOut[], scopeLabel: string) {
  const sorted = [...students].sort(compareStudentFullName);
  const rows = sorted.map((s) => [
    s.student_number,
    formatStudentFullName(s),
    s.last_name,
    s.middle_name ?? "",
    s.first_name,
    s.lin ?? "",
    formatGender(s.gender),
    s.class_level ?? "",
    s.stream_name ?? "",
    s.status,
    s.is_active ? "Yes" : "No",
  ]);
  downloadWorkbook(
    rows,
    STUDENT_COLUMNS,
    `${sanitizeExportFilename(scopeLabel)}-roster-${stamp()}.xlsx`,
  );
}

export function exportRegistrationQueueExcel(queue: RegistrationQueueItemOut[], scopeLabel: string) {
  const sorted = [...queue].sort(compareStudentFullName);
  const rows = sorted.map((row) => [
    row.student_number,
    formatStudentFullName(row),
    row.last_name,
    row.middle_name ?? "",
    row.first_name,
    row.class_level ?? "",
    row.stream_name ?? "",
    queueStatusLabel(row.status),
    `${row.sections_complete}/${row.sections_total}`,
    `${row.required_done}/${row.required_total}`,
  ]);
  downloadWorkbook(
    rows,
    QUEUE_COLUMNS,
    `${sanitizeExportFilename(scopeLabel)}-term-check-in-${stamp()}.xlsx`,
  );
}

export function exportRegisteredRosterExcel(roster: RegisteredStudentOut[], scopeLabel: string) {
  const sorted = [...roster].sort(compareStudentFullName);
  const rows = sorted.map((row) => [
    row.student_number,
    formatStudentFullName(row),
    row.last_name,
    row.middle_name ?? "",
    row.first_name,
    row.class_level ?? "",
    row.stream_name ?? "",
    formatRegisteredAt(row.registered_at),
  ]);
  downloadWorkbook(
    rows,
    REGISTERED_COLUMNS,
    `${sanitizeExportFilename(scopeLabel)}-registered-${stamp()}.xlsx`,
  );
}
