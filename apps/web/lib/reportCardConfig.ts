/** Per-school report card layout — stored on the school record. */

export type ReportCardTemplateId = "uneb_standard_v1" | "primary_simple_v1";

export interface ReportCardSectionsConfig {
  header: boolean;
  assessment_matrix: boolean;
  subject_performance: boolean;
  summary_bar: boolean;
  grading_key: boolean;
  attendance: boolean;
  teacher_comments: boolean;
  footer: boolean;
  signatures: boolean;
  /** Show aggregate / division summary (typically P7). */
  show_aggregate: boolean;
}

export interface ReportCardLayoutConfig {
  template_id: ReportCardTemplateId;
  document_title: string;
  primary_color: string;
  sections: ReportCardSectionsConfig;
}

export const DEFAULT_REPORT_CARD_SECTIONS: ReportCardSectionsConfig = {
  header: true,
  assessment_matrix: true,
  subject_performance: true,
  summary_bar: true,
  grading_key: true,
  attendance: true,
  teacher_comments: true,
  footer: true,
  signatures: true,
  show_aggregate: true,
};

export const DEFAULT_REPORT_CARD_LAYOUT: ReportCardLayoutConfig = {
  template_id: "uneb_standard_v1",
  document_title: "Terminal Report",
  primary_color: "#334155",
  sections: DEFAULT_REPORT_CARD_SECTIONS,
};

export const REPORT_CARD_TEMPLATE_OPTIONS: {
  id: ReportCardTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: "uneb_standard_v1",
    label: "UNEB standard",
    description: "Full layout with assessment matrix, grades, and comments.",
  },
  {
    id: "primary_simple_v1",
    label: "Primary simple",
    description: "Compact layout — subjects and comments without the marks matrix.",
  },
];

export function mergeReportCardLayout(
  partial: Partial<ReportCardLayoutConfig> | null | undefined,
): ReportCardLayoutConfig {
  if (!partial) return DEFAULT_REPORT_CARD_LAYOUT;
  return {
    template_id: partial.template_id ?? DEFAULT_REPORT_CARD_LAYOUT.template_id,
    document_title: partial.document_title?.trim() || DEFAULT_REPORT_CARD_LAYOUT.document_title,
    primary_color: DEFAULT_REPORT_CARD_LAYOUT.primary_color,
    sections: { ...DEFAULT_REPORT_CARD_SECTIONS, ...partial.sections },
  };
}
