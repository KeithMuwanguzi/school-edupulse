"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
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
      <PageToolbar className="sm:justify-between">
        <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max rounded-lg border border-slate-200 bg-white p-0.5">
            {MODES.map((m) => (
              <Link
                key={m.key}
                href={`/app/m/admissions/new?mode=${m.key}`}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                  mode === m.key
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <PageToolbarGroup>
          <Link
            href="/app/m/admissions"
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 sm:w-auto"
          >
            <Icon name="chevron-left" size={13} />
            Pipeline
          </Link>
        </PageToolbarGroup>
      </PageToolbar>

      {mode === "single" && <NewAdmissionApplicationForm />}
      {mode === "multiple" && <BulkAdmissionApplicationForm />}
      {mode === "import" && <AdmissionImportSection />}
    </div>
  );
}
