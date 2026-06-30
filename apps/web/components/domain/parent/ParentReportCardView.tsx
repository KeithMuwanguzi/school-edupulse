"use client";

import { useMemo, useState } from "react";
import { ReportCardPreview } from "@/components/domain/reportcards/ReportCardPreview";
import { ReportCardViewport } from "@/components/domain/reportcards/ReportCardViewport";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { parseError } from "@/lib/apiError";
import {
  useAcademicContextQuery,
  useGetParentOverviewQuery,
  useGetParentReportCardPreviewQuery,
  useLazyGetParentReportCardPdfQuery,
} from "@/store/api/skulpulseApi";

export function ParentReportCardView() {
  const { data: ctx } = useAcademicContextQuery();
  const { data: overview } = useGetParentOverviewQuery();
  const termId = ctx?.active_term?.id;
  const termLabel = ctx?.active_term?.label ?? "Active term";

  const {
    data: preview,
    isLoading,
    isError,
    error,
    isFetching,
  } = useGetParentReportCardPreviewQuery(termId ? { termId } : undefined);

  const [fetchPdf, { isFetching: pdfLoading }] = useLazyGetParentReportCardPdfQuery();
  const [exportError, setExportError] = useState<string | null>(null);

  const childName = useMemo(() => {
    if (!overview?.child) return "Your child";
    return (
      overview.child.preferred_name?.trim() ||
      `${overview.child.first_name} ${overview.child.last_name}`.trim()
    );
  }, [overview]);

  async function handleDownloadPdf() {
    setExportError(null);
    try {
      const blob = await fetchPdf(termId ? { termId } : undefined).unwrap();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${overview?.child.student_number ?? "report-card"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const p = parseError(err);
      setExportError(p.message);
    }
  }

  function handlePrint() {
    document.body.classList.add("printing-report-cards");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-report-cards"), 500);
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-rise">
      <PageHeader
        eyebrow="Report card"
        title={childName}
        description={`Term report for ${termLabel}. Shared with all guardians on this login.`}
      />

      {isError ? (
        <ErrorBanner message={parseError(error).message} />
      ) : !preview ? (
        <EmptyState
          icon={<Icon name="book" size={18} />}
          title="Report not ready"
          description="The school has not published a report card for this term yet, or term registration is incomplete."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="secondary" onClick={handlePrint}>
              Print
            </Button>
            <Button size="sm" loading={pdfLoading} onClick={() => void handleDownloadPdf()}>
              Download PDF
            </Button>
          </div>
          {exportError ? <ErrorBanner message={exportError} /> : null}
          <Card className="print:border-0 print:shadow-none">
            <CardHeader
              title="Preview"
              description={isFetching ? "Refreshing…" : undefined}
            />
            <CardBody>
              <ReportCardViewport>
                <ReportCardPreview data={preview} />
              </ReportCardViewport>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
