"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parseCsv } from "@/components/domain/settings/users/csvParse";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { MarksImportRow, MarksImportRowResult } from "@/lib/types";
import { useImportAssessmentMarksMutation } from "@/store/api/skulpulseApi";

const compactControl = "h-7 text-[12px]";

type FieldKey = "student_number" | "first_name" | "last_name" | "score";

const FIELDS: { key: FieldKey; label: string; hints: string[] }[] = [
  { key: "student_number", label: "Pupil number", hints: ["number", "no", "id", "reg", "index"] },
  { key: "first_name", label: "First name", hints: ["first", "given", "name"] },
  { key: "last_name", label: "Last name", hints: ["last", "surname", "family"] },
  { key: "score", label: "Score", hints: ["score", "mark", "marks", "result", "total"] },
];

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  imported: "green",
  valid: "green",
  skipped: "amber",
  failed: "red",
};

async function readMatrix(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return raw.map((row) =>
      (row ?? []).map((cell) => {
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell ?? "").trim();
      }),
    );
  }
  const text = await file.text();
  return parseCsv(text);
}

function guessMap(headers: string[]): Record<FieldKey, number | null> {
  const map: Record<FieldKey, number | null> = {
    student_number: null,
    first_name: null,
    last_name: null,
    score: null,
  };
  headers.forEach((header, idx) => {
    const h = header.toLowerCase().replace(/[^a-z]/g, "");
    for (const field of FIELDS) {
      if (map[field.key] !== null) continue;
      if (field.hints.some((hint) => h.includes(hint))) {
        map[field.key] = idx;
        return;
      }
    }
  });
  return map;
}

export function MarksImportSection({
  setId,
  classId,
  subjectId,
  subjectName,
  maxMark,
  onClose,
  onImported,
}: {
  setId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  maxMark: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<FieldKey, number | null>>({
    student_number: null,
    first_name: null,
    last_name: null,
    score: null,
  });
  const [results, setResults] = useState<MarksImportRowResult[] | null>(null);
  const [importMarks, { isLoading }] = useImportAssessmentMarksMutation();

  const rows: MarksImportRow[] = useMemo(() => {
    return dataRows.map((cells) => ({
      student_number: map.student_number != null ? cells[map.student_number] || null : null,
      first_name: map.first_name != null ? cells[map.first_name] || null : null,
      last_name: map.last_name != null ? cells[map.last_name] || null : null,
      score:
        map.score != null && cells[map.score] !== "" && cells[map.score] != null
          ? Number(cells[map.score])
          : null,
    }));
  }, [dataRows, map]);

  const ready =
    rows.length > 0 &&
    map.score != null &&
    (map.student_number != null || (map.first_name != null && map.last_name != null));

  async function handleFile(file: File) {
    try {
      const matrix = await readMatrix(file);
      const nonEmpty = matrix.filter((row) => row.some((c) => (c ?? "").trim()));
      if (nonEmpty.length < 2) {
        toast("The sheet needs a header row and at least one pupil.", "error");
        return;
      }
      const head = nonEmpty[0].map((c) => c.trim());
      setHeaders(head);
      setDataRows(nonEmpty.slice(1));
      setMap(guessMap(head));
      setResults(null);
    } catch {
      toast("Could not read that file. Use .xlsx or .csv.", "error");
    }
  }

  async function run(dryRun: boolean) {
    try {
      const res = await importMarks({
        set_id: setId,
        class_id: classId,
        subject_id: subjectId,
        rows,
        dry_run: dryRun,
      }).unwrap();
      setResults(res.results);
      if (dryRun) {
        toast(`${res.valid} ready, ${res.skipped} skipped, ${res.failed} errors.`, "info");
      } else {
        toast(`${res.imported} mark(s) imported.`, "success");
        onImported();
      }
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-800">
          Import marks for {subjectName} (out of {maxMark})
        </p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-[12px] text-slate-500">
        Upload one sheet for this class and subject. Pupils who are not fully onboarded for the
        term are skipped automatically.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          Choose file (.xlsx / .csv)
        </Button>
        {dataRows.length > 0 && (
          <span className="text-[12px] text-slate-500">{dataRows.length} row(s) loaded</span>
        )}
      </div>

      {headers.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((field) => (
            <FormField key={field.key} label={field.label}>
              <Select
                value={map[field.key] ?? ""}
                onChange={(e) =>
                  setMap((prev) => ({
                    ...prev,
                    [field.key]: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={compactControl}
              >
                <option value="">—</option>
                {headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    {h || `Column ${idx + 1}`}
                  </option>
                ))}
              </Select>
            </FormField>
          ))}
        </div>
      )}

      {headers.length > 0 && (
        <p className="text-[11px] text-slate-400">
          Match a pupil number, or both first and last name. The score column is required.
        </p>
      )}

      {ready && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={isLoading} onClick={() => void run(true)}>
            Validate
          </Button>
          <Button size="sm" loading={isLoading} onClick={() => void run(false)}>
            Import marks
          </Button>
        </div>
      )}

      {results && (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Pupil</TH>
                <TH>Score</TH>
                <TH>Status</TH>
                <TH>Note</TH>
              </TR>
            </THead>
            <TBody>
              {results.map((r) => (
                <TR key={r.line}>
                  <TD>{r.line}</TD>
                  <TD>{r.identifier}</TD>
                  <TD>{r.score ?? "—"}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </TD>
                  <TD className="text-[12px] text-slate-500">{r.message ?? ""}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
