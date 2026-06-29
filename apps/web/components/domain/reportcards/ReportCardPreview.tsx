"use client";

import type { ReportCardPreviewOut } from "@/lib/types";
import { mergeReportCardLayout } from "@/lib/reportCardConfig";
import { PrimarySimpleTemplate } from "./templates/PrimarySimpleTemplate";
import { UnebStandardTemplate } from "./templates/UnebStandardTemplate";

export function ReportCardPreview({ data }: { data: ReportCardPreviewOut }) {
  const layout = mergeReportCardLayout(data.layout);
  const Template =
    layout.template_id === "primary_simple_v1" ? PrimarySimpleTemplate : UnebStandardTemplate;

  return (
    <div className="report-card-page">
      <Template data={data} layout={layout} />
    </div>
  );
}
