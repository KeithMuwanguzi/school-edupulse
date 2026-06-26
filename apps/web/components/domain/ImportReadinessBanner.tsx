"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  evaluateImportReadiness,
  type ImportFlow,
  type ImportReadinessIssue,
} from "@/lib/importReadiness";
import {
  useAcademicContextQuery,
  useListClassesQuery,
  useListSubjectsQuery,
  useListTeacherStaffQuery,
  useRosterSummaryQuery,
} from "@/store/api/skulpulseApi";

const severityStyles: Record<ImportReadinessIssue["severity"], string> = {
  block: "border-red-200 bg-red-50 text-red-900",
  warn: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

interface ImportReadinessBannerProps {
  flow: ImportFlow;
  className?: string;
}

export function useImportReadiness(flow: ImportFlow) {
  const { data: classes } = useListClassesQuery();
  const { data: subjects } = useListSubjectsQuery(undefined, {
    skip: flow !== "timetable",
  });
  const { data: staff } = useListTeacherStaffQuery(undefined, {
    skip: flow !== "timetable",
  });
  const { data: roster } = useRosterSummaryQuery(undefined, {
    skip: flow !== "guardians" && flow !== "students",
  });
  const { data: academic } = useAcademicContextQuery();

  return evaluateImportReadiness({
    flow,
    classes,
    subjects,
    teacherCount: staff?.length,
    studentCount: roster?.total,
    activeTermLabel: academic?.active_term?.label ?? null,
  });
}

export function ImportReadinessBanner({ flow, className }: ImportReadinessBannerProps) {
  const { issues, canProceed } = useImportReadiness(flow);

  if (issues.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {issues.map((issue) => (
        <div
          key={`${issue.severity}-${issue.message.slice(0, 40)}`}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed",
            severityStyles[issue.severity],
          )}
        >
          <p>{issue.message}</p>
          {issue.href && issue.actionLabel && (
            <Link
              href={issue.href}
              className="mt-1 inline-block font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              {issue.actionLabel}
            </Link>
          )}
        </div>
      ))}
      {!canProceed && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">
          Resolve blocked items above before importing.
        </p>
      )}
    </div>
  );
}

export function ImportReadinessGate({
  flow,
  children,
}: {
  flow: ImportFlow;
  children: (props: { canProceed: boolean }) => React.ReactNode;
}) {
  const { canProceed } = useImportReadiness(flow);
  return <>{children({ canProceed })}</>;
}
