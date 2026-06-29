"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportCardPreview } from "@/components/domain/reportcards/ReportCardPreview";
import { ReportCardViewport } from "@/components/domain/reportcards/ReportCardViewport";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import {
  DEFAULT_REPORT_CARD_LAYOUT,
  mergeReportCardLayout,
  REPORT_CARD_TEMPLATE_OPTIONS,
  type ReportCardLayoutConfig,
  type ReportCardSectionsConfig,
} from "@/lib/reportCardConfig";
import type { ReportCardPreviewOut } from "@/lib/types";
import { useGetTenantSchoolQuery, useUpdateTenantSchoolMutation } from "@/store/api/skulpulseApi";

const SECTION_LABELS: { key: keyof ReportCardSectionsConfig; label: string; hint?: string }[] = [
  { key: "header", label: "School header & badge" },
  { key: "assessment_matrix", label: "Assessment matrix", hint: "UNEB standard only" },
  { key: "subject_performance", label: "Subject performance table" },
  { key: "summary_bar", label: "Average / aggregate summary" },
  { key: "show_aggregate", label: "Show aggregate & division", hint: "PLE classes" },
  { key: "grading_key", label: "Grading key sidebar" },
  { key: "attendance", label: "Attendance" },
  { key: "teacher_comments", label: "Teacher comments" },
  { key: "footer", label: "Important notes footer" },
  { key: "signatures", label: "Signature blocks" },
];

const SAMPLE_PREVIEW: ReportCardPreviewOut = {
  layout: DEFAULT_REPORT_CARD_LAYOUT,
  school: {
    name: "Sample Primary School",
    motto: "Excellence in learning",
    badge_url: null,
    head_teacher_name: "Head Teacher",
    address_line: "Kampala, Uganda",
    phone: "+256 700 000000",
    email: "office@school.ug",
  },
  student: {
    student_id: "00000000-0000-0000-0000-000000000001",
    student_number: "2026/001",
    first_name: "Jane",
    last_name: "Nakato",
    middle_name: null,
    class_label: "P.5",
    stream_name: "East",
  },
  term: {
    term_id: "00000000-0000-0000-0000-000000000002",
    label: "Term II",
    term_number: 2,
    academic_year_label: "2026",
  },
  assessment_mode: "subject_ca",
  level_section: "Upper primary",
  marks_available: true,
  assessment_sets: [
    { set_id: "1", name: "Mid term", max_mark: 100, sort_order: 1, included_in_ca: true },
  ],
  subject_lines: [
    {
      subject_id: "1",
      subject_code: "ENG",
      subject_name: "English",
      status: "entered",
      is_core: true,
      competence: null,
      ca_score: 78,
      total_score: 78,
      grade: "C3",
      aggregate_points: 3,
      comment: "Good",
      set_scores: [{ set_id: "1", score: 78, max_mark: 100, percentage: 78 }],
    },
    {
      subject_id: "2",
      subject_code: "MAT",
      subject_name: "Mathematics",
      status: "entered",
      is_core: true,
      competence: null,
      ca_score: 85,
      total_score: 85,
      grade: "D2",
      aggregate_points: 2,
      comment: "Very good",
      set_scores: [{ set_id: "1", score: 85, max_mark: 100, percentage: 85 }],
    },
  ],
  grading_key: [
    { label: "D1", min_mark: 90, max_mark: 100, aggregate_points: 1 },
    { label: "D2", min_mark: 80, max_mark: 89, aggregate_points: 2 },
    { label: "C3", min_mark: 75, max_mark: 79, aggregate_points: 3 },
  ],
  footer: {
    next_term_label: "Term III",
    next_term_note: "Reporting date to be announced.",
    requirements_text: "Full uniform and exercise books.",
  },
  average_score: 81.5,
  aggregate: 5,
  total_marks: 163,
  total_aggregate: 5,
  division_label: "Division I",
  attendance: { present_days: 58, total_days: 62, percentage: 93.5 },
  class_teacher_comment: "A commendable term. Keep reading at home.",
  head_teacher_comment: "Well done — continue working hard.",
  comments_status: "resolved",
  generated_at: new Date().toISOString(),
};

export function ReportCardSettingsView() {
  const { toast } = useToast();
  const { data: school, isLoading } = useGetTenantSchoolQuery();
  const [updateSchool, { isLoading: saving }] = useUpdateTenantSchoolMutation();
  const [layout, setLayout] = useState<ReportCardLayoutConfig>(DEFAULT_REPORT_CARD_LAYOUT);

  useEffect(() => {
    if (school?.profile.report_card_layout) {
      setLayout(mergeReportCardLayout(school.profile.report_card_layout));
    }
  }, [school]);

  const previewData = useMemo((): ReportCardPreviewOut => {
    return {
      ...SAMPLE_PREVIEW,
      layout,
      school: {
        ...SAMPLE_PREVIEW.school,
        name: school?.profile.name ?? SAMPLE_PREVIEW.school.name,
        motto: school?.profile.motto ?? SAMPLE_PREVIEW.school.motto,
        badge_url: school?.profile.badge_url ?? null,
        head_teacher_name: school?.profile.head_teacher_name ?? SAMPLE_PREVIEW.school.head_teacher_name,
      },
    };
  }, [layout, school?.profile]);

  const dirty = useMemo(() => {
    if (!school) return false;
    const saved = mergeReportCardLayout(school.profile.report_card_layout);
    return JSON.stringify(saved) !== JSON.stringify(layout);
  }, [layout, school]);

  if (isLoading || !school) return <PageLoader />;

  function toggleSection(key: keyof ReportCardSectionsConfig) {
    setLayout((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }));
  }

  async function saveLayout() {
    try {
      await updateSchool({
        report_card_layout: layout,
        version: school!.profile.version,
      }).unwrap();
      toast("Report card layout saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHeader
            icon={<Icon name="book" size={13} />}
            title="Layout & branding"
            description="Template and document title applied to every report card."
          />
          <CardBody className="grid gap-4">
            <FormField label="Template">
              <Select
                value={layout.template_id}
                onChange={(e) =>
                  setLayout((prev) => ({
                    ...prev,
                    template_id: e.target.value as ReportCardLayoutConfig["template_id"],
                  }))
                }
              >
                {REPORT_CARD_TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-slate-500">
                {REPORT_CARD_TEMPLATE_OPTIONS.find((o) => o.id === layout.template_id)?.description}
              </p>
            </FormField>
            <FormField label="Document title">
              <Input
                value={layout.document_title}
                onChange={(e) => setLayout((prev) => ({ ...prev, document_title: e.target.value }))}
                placeholder="Terminal Report"
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Icon name="grid" size={13} />}
            title="Sections"
            description="Toggle blocks on or off. Changes apply to preview, print, and PDF export."
          />
          <CardBody className="space-y-2">
            {SECTION_LABELS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50/60"
              >
                <input
                  type="checkbox"
                  checked={layout.sections[key]}
                  onChange={() => toggleSection(key)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[13px] font-medium text-slate-800">{label}</span>
                  {hint ? <span className="block text-[10px] text-slate-500">{hint}</span> : null}
                </span>
              </label>
            ))}
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveLayout()} loading={saving} disabled={!dirty}>
            Save layout
          </Button>
          <Button
            variant="secondary"
            onClick={() => setLayout(mergeReportCardLayout(school.profile.report_card_layout))}
            disabled={!dirty}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[12px] font-semibold text-slate-700">Live preview</p>
        <ReportCardViewport>
          <ReportCardPreview data={previewData} />
        </ReportCardViewport>
      </div>
    </div>
  );
}
