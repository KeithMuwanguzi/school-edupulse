"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { PageLoader } from "@/components/ui/Spinner";
import { TermRegistrationQueueView } from "./TermRegistrationQueueView";
import { TermRegisteredRosterView } from "./TermRegisteredRosterView";

const SUB_TABS = [
  { key: "queue", label: "To do" },
  { key: "completed", label: "Completed" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["key"];

function TermCheckInContent() {
  const searchParams = useSearchParams();
  const tab: SubTab = searchParams.get("tab") === "completed" ? "completed" : "queue";

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5">
        {SUB_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "queue" ? "/app/m/students/term" : "/app/m/students/term?tab=completed"}
            className={cn(
              "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
              tab === t.key
                ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200/60"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "queue" ? (
        <TermRegistrationQueueView embedded />
      ) : (
        <TermRegisteredRosterView embedded />
      )}
    </div>
  );
}

export function TermCheckInView() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TermCheckInContent />
    </Suspense>
  );
}
