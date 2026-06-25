"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { NewAdmissionApplicationForm } from "./NewAdmissionApplicationForm";
import { BulkAdmissionApplicationForm } from "./BulkAdmissionApplicationForm";
import { AdmissionImportSection } from "./AdmissionImportSection";

const MODES = [
  { key: "single", label: "One applicant" },
  { key: "multiple", label: "Multiple" },
  { key: "import", label: "Import file" },
] as const;

type Mode = (typeof MODES)[number]["key"];

function parseMode(value: string | null): Mode {
  if (value === "multiple" || value === "import") return value;
  return "single";
}

export function NewAdmissionApplicationsView() {
  const searchParams = useSearchParams();
  const mode = parseMode(searchParams.get("mode"));

  return (
    <div className="space-y-3 animate-fade-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {MODES.map((m) => (
            <Link
              key={m.key}
              href={`/app/m/admissions/new?mode=${m.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                mode === m.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {m.label}
            </Link>
          ))}
        </div>
        <Link
          href="/app/m/admissions"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          <Icon name="chevron-left" size={13} />
          Pipeline
        </Link>
      </div>

      {mode === "single" && <NewAdmissionApplicationForm />}
      {mode === "multiple" && <BulkAdmissionApplicationForm />}
      {mode === "import" && <AdmissionImportSection />}
    </div>
  );
}
