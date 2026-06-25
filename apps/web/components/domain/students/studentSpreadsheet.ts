import * as XLSX from "xlsx";
import { parseCsv } from "@/components/domain/settings/users/csvParse";
import { guessColumnMap } from "./studentImportFields";

export async function parseSpreadsheetFile(file: File): Promise<{
  headers: string[];
  rows: string[][];
  columnMap: ReturnType<typeof guessColumnMap>;
}> {
  const name = file.name.toLowerCase();
  let matrix: string[][];

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    matrix = raw.map((row) =>
      (row ?? []).map((cell) => {
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell ?? "").trim();
      }),
    );
  } else {
    const text = await file.text();
    matrix = parseCsv(text);
  }

  const nonEmpty = matrix.filter((row) => row.some((c) => c.trim()));
  if (!nonEmpty.length) {
    return { headers: [], rows: [], columnMap: {} };
  }

  const headers = nonEmpty[0].map((c) => c.trim());
  const columnMap = guessColumnMap(headers);
  return { headers, rows: nonEmpty, columnMap };
}
