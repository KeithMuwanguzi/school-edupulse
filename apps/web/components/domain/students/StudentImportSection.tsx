"use client";

import { useMemo, useState } from "react";
import { ImportReadinessBanner, useImportReadiness } from "@/components/domain/ImportReadinessBanner";
import { SettingsHint } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import {
  runStudentImportBatches,
  STUDENT_IMPORT_BATCH_SIZE,
} from "@/lib/importBatch";
import {
  toastStudentImportCommit,
  toastStudentImportValidate,
} from "@/lib/importToasts";
import type { StudentImportResponse } from "@/lib/types";
import { useImportStudentsMutation } from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import {
  ImportProgressPanel,
  type ImportProgressState,
} from "@/components/ui/ImportProgressPanel";
import {
  downloadStudentTemplate,
  mappedRowsToApi,
  rowsToImportPayload,
  STUDENT_IMPORT_FIELDS,
  validateImportRow,
  type StudentImportFieldKey,
  type StudentImportMappedRow,
} from "./studentImportFields";
import { parseSpreadsheetFile } from "./studentSpreadsheet";

const STEPS = ["Upload", "Map columns", "Validate", "Import"] as const;
type Step = (typeof STEPS)[number];

const compactControl = "h-7 text-[12px]";

interface StudentImportSectionProps {
  onBack: () => void;
}

export function StudentImportSection({ onBack }: StudentImportSectionProps) {
  const { toast } = useToast();
  const { canProceed } = useImportReadiness("students");
  const [step, setStep] = useState<Step>("Upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<StudentImportFieldKey, number>>>({});
  const [mappedRows, setMappedRows] = useState<StudentImportMappedRow[]>([]);
  const [validation, setValidation] = useState<StudentImportResponse | null>(null);
  const [importResult, setImportResult] = useState<StudentImportResponse | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [working, setWorking] = useState(false);
  const [importStudents] = useImportStudentsMutation();

  const previewRows = useMemo(
    () => rowsToImportPayload(rawRows, columnMap).slice(0, 5),
    [rawRows, columnMap],
  );

  async function handleFile(file: File) {
    if (!canProceed) {
      toast("Set up classes under Academics before importing pupils.", "error");
      return;
    }
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.rows.length) {
        toast("The file appears empty.", "error");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnMap(parsed.columnMap);
      setMappedRows([]);
      setValidation(null);
      setImportResult(null);
      setStep("Map columns");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not read file.", "error");
    }
  }

  function applyMapping() {
    const rows = rowsToImportPayload(rawRows, columnMap);
    if (!rows.length) {
      toast("Map at least surname and last name.", "error");
      return;
    }
    const missingRequired = rows.some((r) => validateImportRow(r) !== null);
    if (missingRequired) {
      const firstIssue = rows.map(validateImportRow).find((msg) => msg !== null);
      toast(firstIssue ?? "Some rows are missing required fields.", "error");
      return;
    }
    setMappedRows(rows);
    setStep("Validate");
  }

  async function runValidate() {
    setWorking(true);
    setImportProgress(null);
    try {
      const apiRows = mappedRowsToApi(mappedRows);
      const res = await runStudentImportBatches(
        apiRows,
        STUDENT_IMPORT_BATCH_SIZE,
        "Validating rows",
        (batch, lineOffset) =>
          importStudents({
            rows: batch,
            skip_duplicates: true,
            dry_run: true,
            line_offset: lineOffset,
          }).unwrap(),
        (done, total, phase) => setImportProgress({ done, total, phase }),
      );
      setValidation(res);
      if (!toastStudentImportValidate(toast, res)) return;
      setStep("Import");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    } finally {
      setWorking(false);
      setImportProgress(null);
    }
  }

  async function runImport() {
    setWorking(true);
    setImportProgress(null);
    try {
      const apiRows = mappedRowsToApi(mappedRows);
      const res = await runStudentImportBatches(
        apiRows,
        STUDENT_IMPORT_BATCH_SIZE,
        "Importing pupils",
        (batch, lineOffset) =>
          importStudents({
            rows: batch,
            skip_duplicates: true,
            dry_run: false,
            line_offset: lineOffset,
          }).unwrap(),
        (done, total, phase) => setImportProgress({ done, total, phase }),
      );
      setImportResult(res);
      toastStudentImportCommit(toast, res);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    } finally {
      setWorking(false);
      setImportProgress(null);
    }
  }

  function renderResults(result: StudentImportResponse | null) {
    if (!result) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500">
          Created {result.created} · Skipped {result.skipped} · Failed {result.failed}
          {result.valid > 0 && ` · Valid ${result.valid}`}
        </p>
        {result.results.length > 0 && (
          <ul className="max-h-52 space-y-0.5 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 px-2 py-1.5 font-mono text-[10px] text-slate-500">
            {[...result.results]
              .sort((a, b) => {
                if (a.status === "failed" && b.status !== "failed") return -1;
                if (b.status === "failed" && a.status !== "failed") return 1;
                return a.line - b.line;
              })
              .slice(0, 50)
              .map((row) => (
              <li
                key={`${row.line}-${row.identifier}`}
                className={row.status === "failed" ? "text-red-700" : undefined}
              >
                Line {row.line}: {row.identifier} — {row.status}
                {row.message ? ` — ${row.message}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Import students"
        description="Upload a spreadsheet to enroll learners in bulk."
        action={
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            Back to roster
          </button>
        }
      />
      <CardBody className="space-y-4 py-3">
        <ImportReadinessBanner flow="students" />
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STEPS.map((label, i) => {
            const active = STEPS.indexOf(step) === i;
            const done = STEPS.indexOf(step) > i;
            return (
              <span
                key={label}
                className={`text-[11px] ${active ? "font-medium text-brand-700" : done ? "text-slate-500" : "text-slate-300"}`}
              >
                {i + 1}. {label}
              </span>
            );
          })}
        </div>

        {step === "Upload" && (
          <div className="space-y-3">
            <SettingsHint>
              Use the template — each row needs the same details as the enrollment wizard:
              class, identity, placement, guardian contact, and blood group. Student numbers are
              assigned automatically.
            </SettingsHint>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={downloadStudentTemplate}>
                Download template
              </Button>
              <label className={canProceed ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                <span className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                  Choose file
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  className="hidden"
                  disabled={!canProceed}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {step === "Map columns" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              File: <span className="font-medium text-slate-700">{fileName}</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STUDENT_IMPORT_FIELDS.map((field) => (
                <FormField key={field.key} label={field.label} required={field.required}>
                  <Select
                    value={columnMap[field.key] !== undefined ? String(columnMap[field.key]) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMap((prev) => {
                        const next = { ...prev };
                        if (val === "") delete next[field.key];
                        else next[field.key] = Number(val);
                        return next;
                      });
                    }}
                    className={compactControl}
                  >
                    <option value="">— skip —</option>
                    {headers.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={String(idx)}>
                        {h || `Column ${idx + 1}`}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ))}
            </div>
            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded border border-slate-100">
                <table className="min-w-full text-[10px] text-slate-500">
                  <thead>
                    <tr className="bg-slate-50">
                      {STUDENT_IMPORT_FIELDS.filter((f) => columnMap[f.key] !== undefined).map(
                        (f) => (
                          <th key={f.key} className="px-2 py-1 text-left font-medium">
                            {f.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-50">
                        {STUDENT_IMPORT_FIELDS.filter((f) => columnMap[f.key] !== undefined).map(
                          (f) => (
                            <td key={f.key} className="px-2 py-1">
                              {row[f.key] || "—"}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep("Upload")}>
                Back
              </Button>
              <Button size="sm" variant="secondary" onClick={applyMapping}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "Validate" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {mappedRows.length} row(s) mapped — checking against your school data. Each learner
              gets a fresh student number on import.
            </p>
            {renderResults(validation)}
            <ImportProgressPanel progress={importProgress} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep("Map columns")} disabled={working}>
                Back
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={working}
                disabled={working}
                onClick={() => void runValidate()}
              >
                Validate
              </Button>
            </div>
          </div>
        )}

        {step === "Import" && (
          <div className="space-y-3">
            {validation && (
              <p className="text-[11px] text-slate-500">
                {validation.valid} valid · {validation.failed} failed · {validation.skipped} would
                skip
              </p>
            )}
            {renderResults(validation)}
            <ImportProgressPanel progress={importProgress} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep("Validate")} disabled={working}>
                Re-validate
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={working}
                disabled={working || !validation || validation.valid === 0}
                onClick={() => void runImport()}
              >
                Import {validation?.valid ?? 0} student(s)
              </Button>
            </div>
            {importResult && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                  Import complete
                </p>
                {renderResults(importResult)}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
