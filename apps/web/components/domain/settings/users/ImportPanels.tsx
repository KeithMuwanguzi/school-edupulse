"use client";

import { useState } from "react";
import { ImportReadinessBanner, useImportReadiness } from "@/components/domain/ImportReadinessBanner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { parseError } from "@/lib/apiError";
import { toastGuardianImport, toastStaffImport } from "@/lib/importToasts";
import type { ImportUsersResponse } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { useImportGuardiansMutation, useImportTeachersMutation } from "@/store/api/skulpulseApi";
import { csvHasHeader, parseCsv } from "./csvParse";
import { ImportResultList } from "./UserForms";

const compactControl = "h-7 text-[12px]";

const TEACHER_TEMPLATE = `login_id,name,email,role_key
0004,Jane Nakato,jane@school.ug,teacher
0005,John Okello,john@school.ug,teacher`;

const GUARDIAN_TEMPLATE = `student_number,guardian_name,email,student_first_name,student_last_name
2203992,Mary Namuli,mary@email.com,Kato,Okello
2203993,Peter Ssemwanga,,Amina,Namuli`;

function parseTeacherRows(text: string) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const start = csvHasHeader(rows[0], ["login_id", "name"]) ? 1 : 0;
  return rows.slice(start).map((cells) => ({
    login_id: cells[0] ?? "",
    name: cells[1] ?? "",
    email: cells[2] ?? "",
    role_key: cells[3] || "teacher",
  }));
}

function parseGuardianRows(text: string) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const start = csvHasHeader(rows[0], ["student_number", "guardian_name"]) ? 1 : 0;
  return rows.slice(start).map((cells) => ({
    student_number: cells[0] ?? "",
    guardian_name: cells[1] ?? "",
    email: cells[2] || undefined,
    student_first_name: cells[3] || undefined,
    student_last_name: cells[4] || undefined,
  }));
}

function ImportOptions({
  useSharedPassword,
  setUseSharedPassword,
  sharedPassword,
  setSharedPassword,
  generatePasswords,
  setGeneratePasswords,
}: {
  useSharedPassword: boolean;
  setUseSharedPassword: (v: boolean) => void;
  sharedPassword: string;
  setSharedPassword: (v: string) => void;
  generatePasswords: boolean;
  setGeneratePasswords: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={generatePasswords}
            onChange={(e) => setGeneratePasswords(e.target.checked)}
            className="rounded border-slate-300"
          />
          Generate passwords
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={useSharedPassword}
            onChange={(e) => setUseSharedPassword(e.target.checked)}
            className="rounded border-slate-300"
          />
          Same password for all
        </label>
      </div>
      {useSharedPassword && (
        <FormField label="Shared password" required>
          <Input
            type="password"
            value={sharedPassword}
            onChange={(e) => setSharedPassword(e.target.value)}
            className={`max-w-xs ${compactControl}`}
          />
        </FormField>
      )}
    </div>
  );
}

interface ImportPanelProps {
  schoolCode: string;
}

export function ImportTeachersPanel({ schoolCode }: ImportPanelProps) {
  const { toast } = useToast();
  const { canProceed } = useImportReadiness("staff");
  const [csv, setCsv] = useState(TEACHER_TEMPLATE);
  const [generatePasswords, setGeneratePasswords] = useState(true);
  const [useSharedPassword, setUseSharedPassword] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");
  const [result, setResult] = useState<ImportUsersResponse | null>(null);
  const [importTeachers, { isLoading }] = useImportTeachersMutation();

  async function runImport() {
    const rows = parseTeacherRows(csv).filter((r) => r.login_id && r.name && r.email);
    if (!rows.length) {
      toast("Each row needs login_id, name, and email.", "error");
      return;
    }
    try {
      const res = await importTeachers({
        rows,
        generate_passwords: generatePasswords && !useSharedPassword,
        default_password: useSharedPassword ? sharedPassword : undefined,
      }).unwrap();
      setResult(res);
      toastStaffImport(toast, res);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-2.5">
      <ImportReadinessBanner flow="staff" />
      <ImportOptions
        useSharedPassword={useSharedPassword}
        setUseSharedPassword={setUseSharedPassword}
        sharedPassword={sharedPassword}
        setSharedPassword={setSharedPassword}
        generatePasswords={generatePasswords}
        setGeneratePasswords={setGeneratePasswords}
      />
      <FormField label="CSV" hint={`login_id, name, email required · @${schoolCode}`}>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] text-slate-800 focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" loading={isLoading} onClick={() => void runImport()}>
          Import
        </Button>
        <Label className="cursor-pointer">
          <span className="text-[11px] text-slate-400 hover:text-slate-600">Upload file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then(setCsv);
            }}
          />
        </Label>
      </div>
      <ImportResultList result={result} />
    </div>
  );
}

export function ImportGuardiansPanel({ schoolCode }: ImportPanelProps) {
  const { toast } = useToast();
  const { canProceed } = useImportReadiness("guardians");
  const [csv, setCsv] = useState(GUARDIAN_TEMPLATE);
  const [generatePasswords, setGeneratePasswords] = useState(true);
  const [useSharedPassword, setUseSharedPassword] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");
  const [result, setResult] = useState<ImportUsersResponse | null>(null);
  const [importGuardians, { isLoading }] = useImportGuardiansMutation();

  async function runImport() {
    if (!canProceed) {
      toast("Enroll pupils under Students before importing guardian accounts.", "error");
      return;
    }
    const rows = parseGuardianRows(csv).filter((r) => r.student_number && r.guardian_name);
    if (!rows.length) {
      toast("Add at least one row with student_number and guardian_name.", "error");
      return;
    }
    try {
      const res = await importGuardians({
        rows,
        generate_passwords: generatePasswords && !useSharedPassword,
        default_password: useSharedPassword ? sharedPassword : undefined,
      }).unwrap();
      setResult(res);
      toastGuardianImport(toast, res);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-2.5">
      <ImportReadinessBanner flow="guardians" />
      <ImportOptions
        useSharedPassword={useSharedPassword}
        setUseSharedPassword={setUseSharedPassword}
        sharedPassword={sharedPassword}
        setSharedPassword={setSharedPassword}
        generatePasswords={generatePasswords}
        setGeneratePasswords={setGeneratePasswords}
      />
      <FormField label="CSV" hint={`student_number@${schoolCode}`}>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] text-slate-800 focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          loading={isLoading}
          disabled={!canProceed}
          onClick={() => void runImport()}
        >
          Import
        </Button>
        <Label className="cursor-pointer">
          <span className="text-[11px] text-slate-400 hover:text-slate-600">Upload file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then(setCsv);
            }}
          />
        </Label>
      </div>
      <ImportResultList result={result} />
    </div>
  );
}
