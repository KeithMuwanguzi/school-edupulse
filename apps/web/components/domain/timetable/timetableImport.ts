import * as XLSX from "xlsx";
import { parseCsv } from "@/components/domain/settings/users/csvParse";

export interface TimetableImportRow {
  day: string;
  starts_at: string;
  ends_at: string;
  class_level: string;
  stream_name?: string;
  subject_code: string;
  teacher: string;
  room?: string;
}

type FieldKey = keyof TimetableImportRow;

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  day: ["day", "weekday", "day_of_week"],
  starts_at: ["starts_at", "start", "start_time", "from", "begin"],
  ends_at: ["ends_at", "end", "end_time", "to", "finish"],
  class_level: ["class_level", "class", "level", "grade"],
  stream_name: ["stream_name", "stream", "section"],
  subject_code: ["subject_code", "subject", "code"],
  teacher: ["teacher", "teacher_name", "teacher_id", "login_id", "staff_id", "teacher_login_id"],
  room: ["room", "venue", "location"],
};

export const TIMETABLE_TEMPLATE_CSV = `day,start_time,end_time,class_level,stream,subject_code,teacher,room
Monday,08:00,08:40,P3,A,ENG,Grace Namuli,Block A
Monday,08:40,09:20,P3,A,MTC,John Okello,Block A
Tuesday,09:20,10:00,P4,,SCI,Grace Namuli,`;

export function downloadTimetableTemplate() {
  const blob = new Blob([TIMETABLE_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "timetable-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function toMatrix(name: string, csvText: string, buffer?: ArrayBuffer): string[][] {
  if ((name.endsWith(".xlsx") || name.endsWith(".xls")) && buffer) {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return raw.map((row) =>
      (row ?? []).map((cell) => {
        if (cell instanceof Date) {
          // Times come through as full datetimes — keep HH:MM.
          return cell.toTimeString().slice(0, 5);
        }
        return String(cell ?? "").trim();
      }),
    );
  }
  return parseCsv(csvText);
}

export async function parseTimetableFile(file: File): Promise<TimetableImportRow[]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
  const matrix = toMatrix(
    name,
    isExcel ? "" : await file.text(),
    isExcel ? await file.arrayBuffer() : undefined,
  );

  const nonEmpty = matrix.filter((row) => row.some((c) => c.trim()));
  if (!nonEmpty.length) return [];

  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const colOf = (key: FieldKey): number =>
    headers.findIndex((h) => HEADER_ALIASES[key].includes(h));

  const cols: Record<FieldKey, number> = {
    day: colOf("day"),
    starts_at: colOf("starts_at"),
    ends_at: colOf("ends_at"),
    class_level: colOf("class_level"),
    stream_name: colOf("stream_name"),
    subject_code: colOf("subject_code"),
    teacher: colOf("teacher"),
    room: colOf("room"),
  };

  const cell = (cells: string[], idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

  return nonEmpty.slice(1).flatMap((cells) => {
    const row: TimetableImportRow = {
      day: cell(cells, cols.day),
      starts_at: cell(cells, cols.starts_at),
      ends_at: cell(cells, cols.ends_at),
      class_level: cell(cells, cols.class_level),
      stream_name: cell(cells, cols.stream_name) || undefined,
      subject_code: cell(cells, cols.subject_code),
      teacher: cell(cells, cols.teacher),
      room: cell(cells, cols.room) || undefined,
    };
    // Skip blank lines; let the server validate the rest.
    if (!row.day && !row.subject_code && !row.class_level) return [];
    return [row];
  });
}
