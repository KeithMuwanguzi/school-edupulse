"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import {
  defaultScaleNameForCycle,
  markRangeTemplateLabel,
  MARK_RANGE_GRADE_BANDS,
  scaleTemplateLabel,
  UNEB_PLE_GRADE_BANDS,
} from "@/lib/gradingTemplates";
import { NCDC_CYCLE_LABELS } from "@/lib/ncdcSubjectCatalog";
import { formatCycleLabels } from "@/lib/subjectCycleUtils";
import type { CycleGradingSectionOut, GradingScaleOut, NcdcCycle, SubjectGradingOut } from "@/lib/types";
import {
  useAssignSubjectGradingScaleMutation,
  useCreateGradingScaleMutation,
  useCreateScaleGradeRangeMutation,
  useUpdateSubjectMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { GradingScaleEditor } from "./GradingScaleEditor";

const compact = "h-7 text-[12px]";

function GradeBandPreview({ scale }: { scale: GradingScaleOut }) {
  if (scale.ranges.length === 0) {
    return (
      <p className="text-[11px] text-amber-700">
        No grade bands yet — add manually or apply the UNEB template.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {scale.ranges.map((range) => (
        <span
          key={range.id}
          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] ring-1 ring-slate-200/80"
          title={`Marks ${range.min_mark}–${range.max_mark}%`}
        >
          <span className="font-mono font-bold text-brand-800">{range.aggregate_weight}</span>
          <span className="font-bold text-slate-800">{range.label}</span>
          {range.comment && (
            <span className="text-slate-600">{range.comment}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function SubjectAssignmentRow({
  subject,
  scales,
  sectionCycle,
  disabled,
}: {
  subject: SubjectGradingOut;
  scales: GradingScaleOut[];
  sectionCycle: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [assignScale, { isLoading }] = useAssignSubjectGradingScaleMutation();

  async function onChange(scaleId: string) {
    try {
      await assignScale({
        subjectId: subject.subject_id,
        grading_scale_id: scaleId || null,
        ncdc_cycle: sectionCycle,
      }).unwrap();
      toast(`${subject.subject_code} scale updated.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <tr className={cn("border-b border-slate-50", disabled && "opacity-60")}>
      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{subject.subject_code}</td>
      <td className="px-3 py-2.5 text-[12px] text-slate-800">{subject.subject_name}</td>
      <td className="hidden px-3 py-2.5 text-[10px] text-slate-400 sm:table-cell">
        {formatCycleLabels(subject.ncdc_cycles as NcdcCycle[])}
      </td>
      <td className="px-3 py-2.5">
        {disabled || scales.length === 0 ? (
          <span className="text-[11px] text-slate-400">Create a scale first</span>
        ) : (
          <Select
            value={subject.grading_scale_id ?? ""}
            onChange={(e) => void onChange(e.target.value)}
            disabled={isLoading}
            className={cn("max-w-[12rem]", compact)}
          >
            <option value="">Not assigned</option>
            {scales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {subject.grading_scale_id ? (
          <Badge tone="green">Assigned</Badge>
        ) : (
          <Badge tone="amber">Pending</Badge>
        )}
      </td>
    </tr>
  );
}

function ExtendableSubjectRow({
  subject,
  targetCycle,
  targetLabel,
}: {
  subject: SubjectGradingOut;
  targetCycle: NcdcCycle;
  targetLabel: string;
}) {
  const { toast } = useToast();
  const [updateSubject, { isLoading }] = useUpdateSubjectMutation();

  async function extend() {
    const cycles = [...new Set([...subject.ncdc_cycles, targetCycle])] as NcdcCycle[];
    try {
      await updateSubject({
        subjectId: subject.subject_id,
        body: { ncdc_cycles: cycles },
      }).unwrap();
      toast(`${subject.subject_code} added to ${targetLabel}.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2">
      <div>
        <p className="text-[12px] font-medium text-slate-800">
          <span className="font-mono text-[10px] text-slate-400">{subject.subject_code}</span>{" "}
          {subject.subject_name}
        </p>
        <p className="text-[10px] text-slate-500">
          In {formatCycleLabels(subject.ncdc_cycles as NcdcCycle[])} — not yet in {targetLabel}
        </p>
      </div>
      <Button size="sm" variant="secondary" loading={isLoading} onClick={() => void extend()}>
        Add to {targetLabel}
      </Button>
    </div>
  );
}

export function GradingCyclePanel({ section }: { section: CycleGradingSectionOut }) {
  const { toast } = useToast();
  const [createScale, { isLoading: creatingScale }] = useCreateGradingScaleMutation();
  const [createRange, { isLoading: creatingBands }] = useCreateScaleGradeRangeMutation();
  const [assignScale] = useAssignSubjectGradingScaleMutation();
  const [scaleName, setScaleName] = useState("");
  const [expandedScaleId, setExpandedScaleId] = useState<string | null>(
    section.scales[0]?.id ?? null,
  );

  const meta = NCDC_CYCLE_LABELS[section.cycle as NcdcCycle];
  const cycle = section.cycle as NcdcCycle;
  const extendable = section.extendable_subjects ?? [];

  const assignedCount = useMemo(
    () => section.subjects.filter((s) => s.grading_scale_id).length,
    [section.subjects],
  );
  const defaultScale = section.scales[0];

  async function addBlankScale() {
    const name = scaleName.trim() || defaultScaleNameForCycle(cycle);
    try {
      const scale = await createScale({ name, ncdc_cycle: section.cycle }).unwrap();
      setScaleName("");
      setExpandedScaleId(scale.id);
      toast("Grading scale created.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addTemplateScale(bands = UNEB_PLE_GRADE_BANDS, toastSuffix = "UNEB D1–F9 bands") {
    const name = scaleName.trim() || defaultScaleNameForCycle(cycle);
    try {
      const scale = await createScale({ name, ncdc_cycle: section.cycle }).unwrap();
      for (const band of bands) {
        await createRange({
          scaleId: scale.id,
          body: {
            label: band.label,
            aggregate_weight: band.aggregate_weight,
            min_mark: band.min_mark,
            max_mark: band.max_mark,
            comment: band.comment,
          },
        }).unwrap();
      }
      setScaleName("");
      setExpandedScaleId(scale.id);
      toast(`"${name}" created with ${toastSuffix}.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addMarkRangeTemplateScale() {
    await addTemplateScale(MARK_RANGE_GRADE_BANDS, "mark-range bands");
  }

  async function assignAllToDefault() {
    if (!defaultScale) {
      toast("Create a grading scale first.", "error");
      return;
    }
    const pending = section.subjects.filter((s) => !s.grading_scale_id);
    if (pending.length === 0) {
      toast("All subjects already assigned.", "success");
      return;
    }
    try {
      for (const subject of pending) {
        await assignScale({
          subjectId: subject.subject_id,
          grading_scale_id: defaultScale.id,
          ncdc_cycle: section.cycle,
        }).unwrap();
      }
      toast(`${pending.length} subject${pending.length === 1 ? "" : "s"} assigned to ${defaultScale.name}.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const templateBusy = creatingScale || creatingBands;

  return (
    <div className="space-y-4">
      {/* Progress strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subjects</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{section.subjects.length}</p>
          <p className="text-[10px] text-slate-500">In {section.cycle_label}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Assigned</p>
          <p className="mt-1 text-xl font-semibold text-brand-700">
            {assignedCount}/{section.subjects.length || 0}
          </p>
          <p className="text-[10px] text-slate-500">Linked to a scale</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scales</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{section.scales.length}</p>
          <p className="text-[10px] text-slate-500">
            {section.scales.some((s) => s.ranges.length > 0) ? "Bands configured" : "Needs bands"}
          </p>
        </div>
      </div>

      {/* Step 1 — Subjects */}
      <Card>
        <CardHeader
          icon={<Icon name="book" size={13} />}
          title="1 · Assign subjects to scales"
          description={`Every subject in ${section.cycle_label} needs a grading scale for report cards.`}
          action={
            section.subjects.length > 0 && defaultScale ? (
              <Button size="sm" variant="secondary" onClick={() => void assignAllToDefault()}>
                Assign all to {defaultScale.name}
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {section.subjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center">
              <p className="text-[12px] text-slate-600">No subjects tagged for {section.cycle_label} yet.</p>
              <Link href="/app/settings/subjects" className="mt-2 inline-block">
                <Button size="sm" variant="secondary">
                  Go to subjects
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="hidden px-3 py-2 sm:table-cell">Cycles</th>
                    <th className="px-3 py-2">Grading scale</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {section.subjects.map((subject) => (
                    <SubjectAssignmentRow
                      key={subject.subject_id}
                      subject={subject}
                      scales={section.scales}
                      sectionCycle={section.cycle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {extendable.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-semibold text-slate-700">
                Also in your catalogue — extend to {section.cycle_label}
              </p>
              <p className="text-[10px] text-slate-500">
                Subjects like Mathematics or Science may start in P4–P7. Add them here to assign a {section.cycle_label} scale.
              </p>
              {extendable.map((subject) => (
                <ExtendableSubjectRow
                  key={subject.subject_id}
                  subject={subject}
                  targetCycle={cycle}
                  targetLabel={section.cycle_label}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Step 2 — Scales */}
      <Card>
        <CardHeader
          icon={<Icon name="chart" size={13} />}
          title="2 · Grading scales & grade bands"
          description={
            meta
              ? `${meta.title} · ${meta.grades}. Use the UNEB template (D1–F9) or customize your own bands.`
              : "Define mark ranges, aggregate weights, and report-card comments."
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <div className="min-w-[10rem] flex-1">
              <FormField label="New scale name">
                <Input
                  value={scaleName}
                  onChange={(e) => setScaleName(e.target.value)}
                  placeholder={defaultScaleNameForCycle(cycle)}
                  className={compact}
                />
              </FormField>
            </div>
            <Button size="sm" variant="secondary" loading={templateBusy} onClick={() => void addBlankScale()}>
              Blank scale
            </Button>
            <Button size="sm" loading={templateBusy} onClick={() => void addMarkRangeTemplateScale()}>
              <Icon name="spark" size={13} />
              {markRangeTemplateLabel(cycle)}
            </Button>
            <Button size="sm" variant="secondary" loading={templateBusy} onClick={() => void addTemplateScale()}>
              {scaleTemplateLabel(cycle)}
            </Button>
          </div>

          {section.scales.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Start with <span className="font-medium">{markRangeTemplateLabel(cycle)}</span> for
              report-card mark bands, or <span className="font-medium">{scaleTemplateLabel(cycle)}</span>{" "}
              when you also need PLE aggregate divisions on the Aggregate tab.
            </p>
          ) : (
            <div className="space-y-3">
              {section.scales.map((scale) => {
                const open = expandedScaleId === scale.id;
                return (
                  <div
                    key={scale.id}
                    className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedScaleId(open ? null : scale.id)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-900">{scale.name}</p>
                          <Badge tone="neutral">{scale.ranges.length} bands</Badge>
                          <Badge tone="neutral">{scale.subject_count} subjects</Badge>
                        </div>
                        <div className="mt-2">
                          <GradeBandPreview scale={scale} />
                        </div>
                      </div>
                      <Icon
                        name="chevron-down"
                        size={16}
                        className={cn("shrink-0 text-slate-400 transition", open && "rotate-180")}
                      />
                    </button>
                    {open && (
                      <div className="border-t border-slate-100 px-4 py-4">
                        <GradingScaleEditor scale={scale} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
