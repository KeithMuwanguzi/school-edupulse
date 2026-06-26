"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  NCDC_CYCLE_LABELS,
  primaryDefaultsToAdd,
  previewPrimaryP1P3Defaults,
  previewPrimaryP4P7Defaults,
  type PrimaryDefaultPreviewRow,
} from "@/lib/ncdcSubjectCatalog";
import type { NcdcCycle, SubjectOut } from "@/lib/types";

const CORE_PREFIXES = ["ENG", "MTC", "MATH", "SCI", "SST", "SOCIAL"];

function defaultIsCore(code: string, ple?: boolean): boolean {
  if (ple) return true;
  const normalized = code.replace(/\s/g, "").toUpperCase();
  return CORE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function cycleLabel(cycles: NcdcCycle[]): string {
  const labels = cycles.map((c) => NCDC_CYCLE_LABELS[c].short);
  if (labels.includes("P4") && labels.includes("P5–P7")) return "P4–P7";
  if (labels.length === 1 && labels[0] === "P1–P3") return "P1–P3";
  return labels.join(", ");
}

function StatusPill({ row }: { row: PrimaryDefaultPreviewRow }) {
  if (row.status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-100">
        <Icon name="check" size={10} className="[&>circle]:hidden" />
        Added
      </span>
    );
  }
  if (row.status === "partial") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
        Add {cycleLabel(row.missingCycles)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
      Will add
    </span>
  );
}

function DefaultsSection({
  title,
  description,
  preview,
  creating,
  onAdd,
}: {
  title: string;
  description: string;
  preview: PrimaryDefaultPreviewRow[];
  creating: boolean;
  onAdd: (rows: PrimaryDefaultPreviewRow[]) => Promise<void>;
}) {
  const pending = primaryDefaultsToAdd(preview);
  const allComplete = pending.length === 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[12px] font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        {preview.map((row) => (
          <li
            key={row.code}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5 sm:items-center",
              row.status === "complete" && "bg-brand-50/30",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-mono text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">
              {row.code}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-semibold text-slate-900">{row.name}</p>
                {row.ple && (
                  <span className="rounded bg-gold-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-700 ring-1 ring-gold-200/70">
                    PLE
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10.5px] text-slate-500">
                {cycleLabel(row.cycles)}
                {row.hint ? ` · ${row.hint}` : ""}
              </p>
            </div>
            <StatusPill row={row} />
          </li>
        ))}
      </ul>

      <Button
        size="sm"
        variant="accent"
        loading={creating}
        disabled={allComplete}
        onClick={() => void onAdd(pending)}
      >
        {allComplete
          ? "All added"
          : `Add ${pending.length} subject${pending.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}

interface Props {
  subjects: SubjectOut[];
  creating: boolean;
  onAddDefaults: (rows: PrimaryDefaultPreviewRow[], label: string) => Promise<void>;
  onClose?: () => void;
}

export function SubjectDefaultsPanel({ subjects, creating, onAddDefaults, onClose }: Props) {
  const [tab, setTab] = useState<"p1p3" | "p4p7">("p1p3");
  const p1p3 = previewPrimaryP1P3Defaults(subjects);
  const p4p7 = previewPrimaryP4P7Defaults(subjects);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100/80 p-1">
        <button
          type="button"
          onClick={() => setTab("p1p3")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
            tab === "p1p3"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          P1–P3
        </button>
        <button
          type="button"
          onClick={() => setTab("p4p7")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
            tab === "p4p7"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          P4–P7
        </button>
      </div>

      {tab === "p1p3" ? (
        <DefaultsSection
          title="Lower primary · P1–P3"
          description="English, Mathematics, Literacy 1 & 2, Reading, and Religious Education — as on typical P1–P3 report cards."
          preview={p1p3}
          creating={creating}
          onAdd={(rows) => onAddDefaults(rows, "P1–P3")}
        />
      ) : (
        <DefaultsSection
          title="Upper primary · P4–P7"
          description="English, Mathematics, Science, and Social Studies across P4–P7 (PLE subjects marked)."
          preview={p4p7}
          creating={creating}
          onAdd={(rows) => onAddDefaults(rows, "P4–P7")}
        />
      )}

      {onClose && (
        <div className="border-t border-slate-100 pt-3">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

export { defaultIsCore };
