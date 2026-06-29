"use client";

import { useMemo, useState } from "react";
import { ReportCardPreview } from "@/components/domain/reportcards/ReportCardPreview";
import { ReportCardViewport } from "@/components/domain/reportcards/ReportCardViewport";
import {
  exportClassZip,
  exportReportCardToPdf,
  type ClassExportItem,
  type ClassExportProgress,
} from "@/components/domain/reportcards/reportCardExport";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { parseError } from "@/lib/apiError";
import {
  useAcademicContextQuery,
  useLazyReportCardPreviewQuery,
  useReportCardClassesQuery,
  useReportCardPreviewQuery,
  useReportCardStudentsQuery,
} from "@/store/api/skulpulseApi";

export function ReportCardsView() {
  const { data: ctx } = useAcademicContextQuery();
  const termId = ctx?.active_term?.id;
  const termLabel = ctx?.active_term?.label ?? "Term";
  const {
    data: classes,
    isLoading: classesLoading,
    isError: classesError,
    error: classesErr,
  } = useReportCardClassesQuery(termId ? { termId } : undefined);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ClassExportProgress | null>(null);

  const {
    data: students,
    isLoading: studentsLoading,
    isFetching: studentsFetching,
  } = useReportCardStudentsQuery({ classId, termId }, { skip: !classId });

  const {
    data: preview,
    isLoading: previewLoading,
    isFetching: previewFetching,
    isError: previewError,
    error: previewErr,
  } = useReportCardPreviewQuery({ studentId, termId }, { skip: !studentId });

  const [fetchPreview] = useLazyReportCardPreviewQuery();

  const classOptions = useMemo(
    () => (classes ?? []).filter((c) => c.registered_count > 0),
    [classes],
  );
  const selectedClass = classOptions.find((c) => c.class_id === classId);

  function handlePrint() {
    document.body.classList.add("printing-report-cards");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-report-cards"), 500);
  }

  async function handleExportIndividual() {
    if (!preview) return;
    setExportError(null);
    setExporting(true);
    try {
      const name = formatStudentFullName({
        last_name: preview.student.last_name,
        middle_name: preview.student.middle_name,
        first_name: preview.student.first_name,
      });
      await exportReportCardToPdf(preview, `${name} - ${termLabel}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportClass() {
    if (!classId || !students?.length || !selectedClass) return;
    setExportError(null);
    setExporting(true);
    setProgress({ done: 0, total: students.length, currentName: "" });
    try {
      const items: ClassExportItem[] = [];
      for (const s of students) {
        const display = formatStudentFullName({
          last_name: s.last_name,
          middle_name: s.middle_name,
          first_name: s.first_name,
        });
        setProgress({ done: items.length, total: students.length, currentName: display });
        try {
          const data = await fetchPreview({ studentId: s.student_id, termId }).unwrap();
          items.push({ student_id: s.student_id, display_name: display, data });
        } catch {
          // Skip learners whose report cannot be generated (e.g. unregistered).
        }
      }

      if (!items.length) {
        setExportError("No report cards could be generated for this class.");
        return;
      }

      await exportClassZip(items, {
        className: selectedClass.class_label,
        termLabel,
        onProgress: setProgress,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export class report cards.");
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }

  const exportActions = (
    <>
      {classId && students?.length ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={handleExportClass}
          disabled={exporting}
        >
          Export class (ZIP)
        </Button>
      ) : null}
      {preview ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleExportIndividual}
            disabled={exporting}
          >
            Export PDF
          </Button>
          <Button size="sm" className="w-full sm:w-auto" onClick={handlePrint} disabled={exporting}>
            Print
          </Button>
        </>
      ) : null}
    </>
  );

  if (classesLoading) return <PageLoader />;
  if (classesError) {
    return <ErrorBanner message={parseError(classesErr).message} />;
  }

  return (
    <div className={`space-y-5 ${preview ? "pb-24 sm:pb-5" : ""}`}>
      <PageHeader
        eyebrow="Operations"
        title="Report cards"
        description="Preview, print, and export professional term reports. Marks, grades, and remarks are drawn from recorded assessments and Settings → Grading."
        action={
          <div className="hidden sm:block">
            <PageToolbar>{exportActions}</PageToolbar>
          </div>
        }
      />

      <Card className="report-card-no-print">
        <CardHeader
          title="Select learner"
          description="Only students fully registered for the active term are listed."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Class
            </label>
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStudentId("");
              }}
            >
              <option value="">Choose class…</option>
              {classOptions.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_label} ({c.registered_count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Student
            </label>
            <Select
              value={studentId}
              disabled={!classId || studentsLoading || studentsFetching}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Choose student…</option>
              {(students ?? []).map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {formatStudentFullName({
                    last_name: s.last_name,
                    middle_name: s.middle_name,
                    first_name: s.first_name,
                  })}{" "}
                  · {s.student_number}
                </option>
              ))}
            </Select>
          </div>
          {ctx?.active_term ? (
            <div className="flex items-end">
              <p className="text-xs text-slate-500">
                Term: <span className="font-medium text-slate-700">{ctx.active_term.label}</span>
                {ctx.academic_year?.label ? ` · ${ctx.academic_year.label}` : ""}
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {exportError ? (
        <div className="report-card-no-print">
          <ErrorBanner message={exportError} />
        </div>
      ) : null}

      {exporting ? (
        <div className="report-card-no-print rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {progress ? (
            <p>
              Generating report cards… {progress.done}/{progress.total}
              {progress.currentName ? ` · ${progress.currentName}` : ""}
            </p>
          ) : (
            <p>Preparing export…</p>
          )}
          {progress && progress.total > 0 ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!classOptions.length ? (
        <EmptyState
          title="No registered classes"
          description="Complete term check-in for learners before generating report cards."
        />
      ) : null}

      {studentId && previewLoading ? <PageLoader /> : null}
      {studentId && previewError ? (
        <div className="report-card-no-print">
          <ErrorBanner message={parseError(previewErr).message} />
        </div>
      ) : null}
      {preview && !previewFetching ? (
        <div>
          <ReportCardViewport>
            <ReportCardPreview data={preview} />
          </ReportCardViewport>
        </div>
      ) : null}

      {preview && !previewFetching ? (
        <div className="report-card-no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:hidden">
          <PageToolbarGroup className="w-full">{exportActions}</PageToolbarGroup>
        </div>
      ) : null}
    </div>
  );
}
