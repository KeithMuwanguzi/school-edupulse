"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHint } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import type { AdmissionBatchResponse } from "@/lib/types";
import {
  useBatchCreateAdmissionApplicationsMutation,
  useListClassesQuery,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { ALL_CLASS_LEVELS } from "@/lib/schoolLevels";
import {
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  STUDENT_NAME_LABELS,
  studentNameRequiredMessage,
} from "../students/studentOptions";

const compactControl = "h-7 text-[12px]";

interface ApplicantRow {
  id: string;
  last_name: string;
  middle_name: string;
  first_name: string;
  gender: string;
  dob: string;
  guardian_name: string;
  guardian_phone: string;
  previous_school: string;
}

let rowCounter = 0;
function emptyRow(): ApplicantRow {
  rowCounter += 1;
  return {
    id: `row-${rowCounter}`,
    last_name: "",
    middle_name: "",
    first_name: "",
    gender: "",
    dob: "",
    guardian_name: "",
    guardian_phone: "",
    previous_school: "",
  };
}

function initialRows(count: number): ApplicantRow[] {
  return Array.from({ length: count }, () => emptyRow());
}

function ResultSummary({ result }: { result: AdmissionBatchResponse }) {
  return (
    <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[11px] text-slate-600">
        Added {result.created} applicant{result.created === 1 ? "" : "s"}
        {result.failed > 0 && ` · ${result.failed} failed`}
      </p>
      {result.results.some((r) => r.status === "failed") && (
        <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {result.results
            .filter((r) => r.status === "failed")
            .map((r) => (
              <li key={r.line}>
                Row {r.line}: {r.identifier} — {r.message}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export function BulkAdmissionApplicationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: classes = [] } = useListClassesQuery();
  const [batchCreate, { isLoading }] = useBatchCreateAdmissionApplicationsMutation();

  const [classLevel, setClassLevel] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("mother");
  const [rows, setRows] = useState<ApplicantRow[]>(() => initialRows(5));
  const [result, setResult] = useState<AdmissionBatchResponse | null>(null);

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  const filledRows = useMemo(
    () => rows.filter((r) => r.last_name.trim() || r.first_name.trim() || r.middle_name.trim()),
    [rows],
  );

  function updateRow(id: string, patch: Partial<ApplicantRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  async function submit() {
    const payloadRows = filledRows
      .filter((r) => r.last_name.trim() && r.first_name.trim())
      .map((r) => ({
        first_name: r.first_name.trim(),
        last_name: r.last_name.trim(),
        middle_name: r.middle_name.trim() || undefined,
        gender: r.gender || undefined,
        date_of_birth: r.dob || undefined,
        applied_class_level: classLevel || undefined,
        applied_class_id: classId || undefined,
        applied_stream_id: streamId || undefined,
        guardian_name: r.guardian_name.trim() || undefined,
        guardian_relationship: guardianRelationship || undefined,
        guardian_phone: r.guardian_phone.trim() || undefined,
        previous_school: r.previous_school.trim() || undefined,
      }));

    if (!payloadRows.length) {
      const incomplete = filledRows.some((r) => !r.last_name.trim() || !r.first_name.trim());
      toast(
        incomplete ? studentNameRequiredMessage("applicant") : "Enter at least one applicant.",
        "error",
      );
      return;
    }

    try {
      const res = await batchCreate({ rows: payloadRows }).unwrap();
      setResult(res);
      if (res.failed === 0) {
        toast(`${res.created} application(s) added to the pipeline.`, "success");
        router.push("/app/m/admissions");
      } else if (res.created > 0) {
        toast(`${res.created} added · ${res.failed} need attention.`, "error");
      } else {
        toast("No applications were created.", "error");
      }
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Multiple applicants"
        description="Shared class placement applies to every row. Only surname and last name are required per learner."
      />
      <CardBody className="space-y-4">
        <SettingsHint>
          Tip: fill shared entry class once below, then tab through the table. Leave blank rows
          out — they are ignored on save.
        </SettingsHint>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Entry class">
            <Select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={compactControl}>
              <option value="">—</option>
              {ALL_CLASS_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Class">
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

        <div className="space-y-2 md:hidden">
          {rows.map((row, idx) => (
            <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Applicant {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                  aria-label={`Remove applicant ${idx + 1}`}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField label={STUDENT_NAME_LABELS.last_name} required>
                  <Input
                    value={row.last_name}
                    onChange={(e) => updateRow(row.id, { last_name: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label={STUDENT_NAME_LABELS.middle_name}>
                  <Input
                    value={row.middle_name}
                    onChange={(e) => updateRow(row.id, { middle_name: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label={STUDENT_NAME_LABELS.first_name} required>
                  <Input
                    value={row.first_name}
                    onChange={(e) => updateRow(row.id, { first_name: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label="Gender">
                  <Select
                    value={row.gender}
                    onChange={(e) => updateRow(row.id, { gender: e.target.value })}
                    className={compactControl}
                  >
                    <option value="">—</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Date of birth">
                  <Input
                    type="date"
                    value={row.dob}
                    onChange={(e) => updateRow(row.id, { dob: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label="Guardian">
                  <Input
                    value={row.guardian_name}
                    onChange={(e) => updateRow(row.id, { guardian_name: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={row.guardian_phone}
                    onChange={(e) => updateRow(row.id, { guardian_phone: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
                <FormField label="Previous school">
                  <Input
                    value={row.previous_school}
                    onChange={(e) => updateRow(row.id, { previous_school: e.target.value })}
                    className={compactControl}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-2 py-1.5 font-medium text-slate-500 w-8">#</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">
                  {STUDENT_NAME_LABELS.last_name}
                  <span className="ml-0.5 text-red-400">*</span>
                </th>
                <th className="px-2 py-1.5 font-medium text-slate-500">{STUDENT_NAME_LABELS.middle_name}</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">
                  {STUDENT_NAME_LABELS.first_name}
                  <span className="ml-0.5 text-red-400">*</span>
                </th>
                <th className="px-2 py-1.5 font-medium text-slate-500">Gender</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">DOB</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">Guardian</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">Phone</th>
                <th className="px-2 py-1.5 font-medium text-slate-500">Prev. school</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-2 py-1 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.last_name}
                      onChange={(e) => updateRow(row.id, { last_name: e.target.value })}
                      className={compactControl}
                      aria-label={`${STUDENT_NAME_LABELS.last_name} row ${idx + 1}`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.middle_name}
                      onChange={(e) => updateRow(row.id, { middle_name: e.target.value })}
                      className={compactControl}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.first_name}
                      onChange={(e) => updateRow(row.id, { first_name: e.target.value })}
                      className={compactControl}
                      aria-label={`${STUDENT_NAME_LABELS.first_name} row ${idx + 1}`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Select
                      value={row.gender}
                      onChange={(e) => updateRow(row.id, { gender: e.target.value })}
                      className={`w-20 ${compactControl}`}
                    >
                      <option value="">—</option>
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="date"
                      value={row.dob}
                      onChange={(e) => updateRow(row.id, { dob: e.target.value })}
                      className={`w-32 ${compactControl}`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.guardian_name}
                      onChange={(e) => updateRow(row.id, { guardian_name: e.target.value })}
                      className={compactControl}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.guardian_phone}
                      onChange={(e) => updateRow(row.id, { guardian_phone: e.target.value })}
                      className={compactControl}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.previous_school}
                      onChange={(e) => updateRow(row.id, { previous_school: e.target.value })}
                      className={compactControl}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                      aria-label={`Remove row ${idx + 1}`}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setRows((prev) => [...prev, ...initialRows(3)])}>
            <Icon name="plus" size={13} />
            Add 3 rows
          </Button>
          <span className="text-[10px] text-slate-400">
            {filledRows.length} row{filledRows.length === 1 ? "" : "s"} with data
          </span>
        </div>

        {result && <ResultSummary result={result} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => router.push("/app/m/admissions")}>
            Cancel
          </Button>
          <Button size="sm" className="w-full sm:w-auto" loading={isLoading} onClick={() => void submit()}>
            Save {filledRows.length || ""} application{filledRows.length === 1 ? "" : "s"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
