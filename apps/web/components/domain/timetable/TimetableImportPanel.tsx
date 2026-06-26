"use client";

import { useState } from "react";
import { ImportReadinessBanner, useImportReadiness } from "@/components/domain/ImportReadinessBanner";
import { SettingsHint } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import { toastTimetableImport } from "@/lib/importToasts";
import type { TimetableImportResponse } from "@/lib/types";
import { useImportTimetableMutation } from "@/store/api/skulpulseApi";
import {
  downloadTimetableTemplate,
  parseTimetableFile,
  type TimetableImportRow,
} from "./timetableImport";

interface TimetableImportPanelProps {
  onClose: () => void;
}

export function TimetableImportPanel({ onClose }: TimetableImportPanelProps) {
  const { toast } = useToast();
  const { canProceed } = useImportReadiness("timetable");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<TimetableImportRow[]>([]);
  const [validation, setValidation] = useState<TimetableImportResponse | null>(null);
  const [done, setDone] = useState<TimetableImportResponse | null>(null);
  const [importTimetable, { isLoading }] = useImportTimetableMutation();

  async function handleFile(file: File) {
    if (!canProceed) {
      toast("Complete classes, subjects, and staff setup before importing a timetable.", "error");
      return;
    }
    try {
      const parsed = await parseTimetableFile(file);
      if (!parsed.length) {
        toast("The file appears empty.", "error");
        return;
      }
      setFileName(file.name);
      setRows(parsed);
      setValidation(null);
      setDone(null);
      // Auto-validate against school data.
      const res = await importTimetable({ rows: parsed, dry_run: true }).unwrap();
      setValidation(res);
      toastTimetableImport(toast, res, "validate");
    } catch (err) {
      const p = parseError(err);
      toast(p.message || (err instanceof Error ? err.message : "Could not read file."), "error");
    }
  }

  async function runImport() {
    try {
      const res = await importTimetable({ rows, dry_run: false }).unwrap();
      setDone(res);
      toastTimetableImport(toast, res, "commit");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const result = done ?? validation;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
          Import term timetable
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <SettingsHint>
        Build your whole term&apos;s weekly timetable in one file. Download the template, add one
        lesson per row (day, start/end time, class, optional stream, subject code, and the
        teacher&apos;s name) for every class, then upload it. Rows are checked before anything is
        saved.
      </SettingsHint>

      <ImportReadinessBanner flow="timetable" className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={downloadTimetableTemplate}>
          <Icon name="arrow-down" size={13} /> Download template
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
              e.target.value = "";
            }}
          />
        </label>
        {fileName && <span className="text-[11px] text-slate-500">{fileName}</span>}
      </div>

      {result && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            {done ? (
              <>
                Imported {done.created} · Failed {done.failed}
              </>
            ) : (
              <>
                {validation!.valid} ready · {validation!.failed} need attention
              </>
            )}
          </p>
          {result.results.some((r) => r.status === "failed") && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 px-2 py-1.5 font-mono text-[10px] text-slate-500">
              {result.results
                .filter((r) => r.status === "failed")
                .slice(0, 30)
                .map((r) => (
                  <li key={`${r.line}-${r.identifier}`}>
                    Row {r.line}: {r.identifier} — {r.message}
                  </li>
                ))}
            </ul>
          )}
          {!done && (
            <div className="flex justify-end">
              <Button
                size="sm"
                loading={isLoading}
                disabled={!validation || validation.valid === 0}
                onClick={() => void runImport()}
              >
                Import {validation?.valid ?? 0} lesson(s)
              </Button>
            </div>
          )}
          {done && (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
