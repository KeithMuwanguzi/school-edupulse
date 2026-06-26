"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImportReadinessBanner } from "@/components/domain/ImportReadinessBanner";
import { SettingsHint } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import { toastAdmissionImport } from "@/lib/importToasts";
import type { AdmissionBatchResponse } from "@/lib/types";
import {
  useBatchCreateAdmissionApplicationsMutation,
  useListClassesQuery,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { parseSpreadsheetFile } from "../students/studentSpreadsheet";
import {
  ADMISSION_IMPORT_FIELDS,
  admissionRowsToPayload,
  downloadAdmissionTemplate,
  guessAdmissionColumnMap,
  mappedAdmissionRowsToApi,
  type AdmissionImportFieldKey,
  type AdmissionImportMappedRow,
} from "./admissionImportFields";
import { RELATIONSHIP_OPTIONS } from "../students/studentOptions";

const STEPS = ["Upload", "Map columns", "Review"] as const;
type Step = (typeof STEPS)[number];
const compactControl = "h-7 text-[12px]";

export function AdmissionImportSection() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: classes = [] } = useListClassesQuery();
  const [batchCreate, { isLoading }] = useBatchCreateAdmissionApplicationsMutation();

  const [step, setStep] = useState<Step>("Upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<AdmissionImportFieldKey, number>>>({});
  const [mappedRows, setMappedRows] = useState<AdmissionImportMappedRow[]>([]);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("mother");
  const [result, setResult] = useState<AdmissionBatchResponse | null>(null);

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  const previewRows = useMemo(
    () => admissionRowsToPayload(rawRows, columnMap).slice(0, 5),
    [rawRows, columnMap],
  );

  async function handleFile(file: File) {
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.rows.length) {
        toast("The file appears empty.", "error");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnMap(guessAdmissionColumnMap(parsed.headers));
      setMappedRows([]);
      setResult(null);
      setStep("Map columns");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not read file.", "error");
    }
  }

  function applyMapping() {
    const rows = admissionRowsToPayload(rawRows, columnMap);
    if (!rows.length) {
      toast("Map at least surname and last name.", "error");
      return;
    }
    const missingRequired = rows.some((r) => !r.first_name || !r.last_name);
    if (missingRequired) {
      toast("Some rows are missing required fields.", "error");
      return;
    }
    setMappedRows(rows);
    setStep("Review");
  }

  async function runImport() {
    try {
      const res = await batchCreate({
        rows: mappedAdmissionRowsToApi(mappedRows, {
          applied_class_id: classId || undefined,
          applied_stream_id: streamId || undefined,
          guardian_relationship: guardianRelationship || undefined,
        }),
      }).unwrap();
      setResult(res);
      toastAdmissionImport(toast, res);
      if (res.failed === 0) {
        router.push("/app/m/admissions");
      }
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Import from file"
        description="Upload a spreadsheet when you already have applicant lists from interviews or open days."
      />
      <CardBody className="space-y-4 py-3">
        <ImportReadinessBanner flow="admissions" />
        <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max gap-2">
            {STEPS.map((label, i) => {
              const active = STEPS.indexOf(step) === i;
              const done = STEPS.indexOf(step) > i;
              return (
                <span
                  key={label}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                    active
                      ? "bg-brand-600 font-medium text-white"
                      : done
                        ? "bg-slate-100 text-slate-600"
                        : "text-slate-300"
                  }`}
                >
                  {i + 1}. {label}
                </span>
              );
            })}
          </div>
        </div>

        {step === "Upload" && (
          <div className="space-y-3">
            <SettingsHint>
              Only surname and last name are required per row. Use the template or match column
              headers on the next step.
            </SettingsHint>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={downloadAdmissionTemplate}>
                Download template
              </Button>
              <label className="cursor-pointer">
                <span className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                  Choose file
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  className="hidden"
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
              {ADMISSION_IMPORT_FIELDS.map((field) => (
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
              <>
                <div className="space-y-2 md:hidden">
                  {previewRows.map((row, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-[11px]">
                      <p className="mb-1 font-medium text-slate-600">Row {i + 1}</p>
                      {ADMISSION_IMPORT_FIELDS.filter((f) => columnMap[f.key] !== undefined).map((f) => (
                        <p key={f.key} className="text-slate-500">
                          <span className="text-slate-400">{f.label}:</span> {row[f.key] || "—"}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded border border-slate-100 md:block">
                <table className="min-w-full text-[10px] text-slate-500">
                  <thead>
                    <tr className="bg-slate-50">
                      {ADMISSION_IMPORT_FIELDS.filter((f) => columnMap[f.key] !== undefined).map(
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
                        {ADMISSION_IMPORT_FIELDS.filter((f) => columnMap[f.key] !== undefined).map(
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
              </>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setStep("Upload")}>
                Back
              </Button>
              <Button size="sm" className="w-full sm:w-auto" onClick={applyMapping}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "Review" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-600">
              <span className="font-medium">{mappedRows.length}</span> applicant
              {mappedRows.length === 1 ? "" : "s"} ready to import.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <FormField label="Class (all rows)">
                <Select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setStreamId("");
                  }}
                  className={compactControl}
                >
                  <option value="">—</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.level} · {c.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Stream">
                <Select
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                  className={compactControl}
                  disabled={streams.length === 0}
                >
                  <option value="">—</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Guardian relationship">
                <Select
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className={compactControl}
                >
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            {result && (
              <p className="text-[11px] text-slate-500">
                Created {result.created} · Failed {result.failed}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setStep("Map columns")}>
                Back
              </Button>
              <Button size="sm" className="w-full sm:w-auto" loading={isLoading} onClick={() => void runImport()}>
                Import {mappedRows.length} application{mappedRows.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
