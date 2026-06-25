"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { Badge } from "@/components/ui/Badge";
import { SettingsHint } from "@/components/layout/settingsUi";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { NCDC_CYCLE_LABELS } from "@/lib/ncdcSubjectCatalog";
import type {
  AggregateDivisionOut,
  CycleGradingSectionOut,
  GradeRangeOut,
  GradingScaleOut,
  SubjectGradingOut,
} from "@/lib/types";
import type { NcdcCycle } from "@/lib/types";
import {
  useAssignSubjectGradingScaleMutation,
  useCreateAggregateDivisionMutation,
  useCreateGradingScaleMutation,
  useCreateScaleGradeRangeMutation,
  useDeleteAggregateDivisionMutation,
  useDeleteGradingScaleMutation,
  useDeleteScaleGradeRangeMutation,
  useGetGradingConfigQuery,
  useUpdateAggregateDivisionMutation,
  useUpdateGradingScaleMutation,
  useUpdateScaleGradeRangeMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

const compact = "h-7 text-[12px]";
const commentArea =
  "w-full min-h-[4.5rem] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function RangeRow({ scaleId, range }: { scaleId: string; range: GradeRangeOut }) {
  const { toast } = useToast();
  const [updateRange, { isLoading: saving }] = useUpdateScaleGradeRangeMutation();
  const [deleteRange] = useDeleteScaleGradeRangeMutation();
  const [draft, setDraft] = useState({
    label: range.label,
    aggregate_weight: String(range.aggregate_weight),
    min_mark: String(range.min_mark),
    max_mark: String(range.max_mark),
    class_teacher_comment: range.class_teacher_comment ?? "",
    head_teacher_comment: range.head_teacher_comment ?? "",
  });

  async function save() {
    try {
      await updateRange({
        scaleId,
        rangeId: range.id,
        body: {
          label: draft.label.trim(),
          aggregate_weight: Number(draft.aggregate_weight),
          min_mark: Number(draft.min_mark),
          max_mark: Number(draft.max_mark),
          class_teacher_comment: draft.class_teacher_comment.trim() || null,
          head_teacher_comment: draft.head_teacher_comment.trim() || null,
        },
      }).unwrap();
      toast("Saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <tr className="border-b border-slate-50 align-top">
      <td className="px-2 py-2">
        <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className={compact} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <Input type="number" value={draft.min_mark} onChange={(e) => setDraft((d) => ({ ...d, min_mark: e.target.value }))} className={`w-14 ${compact}`} />
          <span className="text-slate-300">–</span>
          <Input type="number" value={draft.max_mark} onChange={(e) => setDraft((d) => ({ ...d, max_mark: e.target.value }))} className={`w-14 ${compact}`} />
        </div>
      </td>
      <td className="px-2 py-2">
        <Input type="number" min={1} max={9} value={draft.aggregate_weight} onChange={(e) => setDraft((d) => ({ ...d, aggregate_weight: e.target.value }))} className={`w-14 ${compact}`} />
      </td>
      <td className="min-w-[12rem] px-2 py-2">
        <textarea
          value={draft.class_teacher_comment}
          onChange={(e) => setDraft((d) => ({ ...d, class_teacher_comment: e.target.value }))}
          rows={3}
          maxLength={2000}
          placeholder="Class teacher remark for this band…"
          className={commentArea}
        />
      </td>
      <td className="min-w-[12rem] px-2 py-2">
        <textarea
          value={draft.head_teacher_comment}
          onChange={(e) => setDraft((d) => ({ ...d, head_teacher_comment: e.target.value }))}
          rows={3}
          maxLength={2000}
          placeholder="Head teacher remark for this band…"
          className={commentArea}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void save()}>Save</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void (async () => {
                try {
                  await deleteRange({ scaleId, rangeId: range.id }).unwrap();
                  toast("Grade removed.", "success");
                } catch (err) {
                  const p = parseError(err);
                  toast(p.message, "error", p.requestId);
                }
              })()
            }
          >
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ScalePanel({ scale }: { scale: GradingScaleOut }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [scaleName, setScaleName] = useState(scale.name);
  const [createRange, { isLoading: creating }] = useCreateScaleGradeRangeMutation();
  const [updateScale, { isLoading: renaming }] = useUpdateGradingScaleMutation();
  const [deleteScale] = useDeleteGradingScaleMutation();
  const [newBand, setNewBand] = useState({
    label: "",
    aggregate_weight: "1",
    min_mark: "0",
    max_mark: "100",
    class_teacher_comment: "",
    head_teacher_comment: "",
  });

  async function saveScaleName() {
    const trimmed = scaleName.trim();
    if (!trimmed || trimmed === scale.name) return;
    try {
      await updateScale({ scaleId: scale.id, body: { name: trimmed } }).unwrap();
      toast("Scale renamed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addBand() {
    if (!newBand.label.trim()) return;
    try {
      await createRange({
        scaleId: scale.id,
        body: {
          label: newBand.label.trim(),
          aggregate_weight: Number(newBand.aggregate_weight),
          min_mark: Number(newBand.min_mark),
          max_mark: Number(newBand.max_mark),
          class_teacher_comment: newBand.class_teacher_comment.trim() || null,
          head_teacher_comment: newBand.head_teacher_comment.trim() || null,
        },
      }).unwrap();
      setNewBand({
        label: "",
        aggregate_weight: "1",
        min_mark: "0",
        max_mark: "100",
        class_teacher_comment: "",
        head_teacher_comment: "",
      });
      toast("Band added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="rounded-lg border border-slate-100">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50/80"
      >
        <div>
          <p className="text-[12px] font-semibold text-slate-800">{scale.name}</p>
          <p className="text-[10px] text-slate-400">
            {scale.ranges.length} bands · {scale.subject_count} subject{scale.subject_count === 1 ? "" : "s"}
          </p>
        </div>
        <Icon name="chevron-down" size={14} className={cn("text-slate-400 transition", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Scale name" required>
              <Input
                value={scaleName}
                onChange={(e) => setScaleName(e.target.value)}
                onBlur={() => void saveScaleName()}
                className={`w-48 ${compact}`}
              />
            </FormField>
            <Button
              size="sm"
              variant="secondary"
              loading={renaming}
              disabled={!scaleName.trim() || scaleName.trim() === scale.name}
              onClick={() => void saveScaleName()}
            >
              Save name
            </Button>
          </div>

          {scale.ranges.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">Grade</th>
                    <th className="px-2 py-2">Marks</th>
                    <th className="px-2 py-2">Wt</th>
                    <th className="px-2 py-2">Class teacher comment</th>
                    <th className="px-2 py-2">Head teacher comment</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scale.ranges.map((range) => (
                    <RangeRow key={range.id} scaleId={scale.id} range={range} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Grade" required>
              <Input value={newBand.label} onChange={(e) => setNewBand((d) => ({ ...d, label: e.target.value }))} placeholder="Distinction 1" className={`w-28 ${compact}`} />
            </FormField>
            <FormField label="Marks">
              <div className="flex items-center gap-1">
                <Input type="number" value={newBand.min_mark} onChange={(e) => setNewBand((d) => ({ ...d, min_mark: e.target.value }))} className={`w-14 ${compact}`} />
                <span className="text-slate-300">–</span>
                <Input type="number" value={newBand.max_mark} onChange={(e) => setNewBand((d) => ({ ...d, max_mark: e.target.value }))} className={`w-14 ${compact}`} />
              </div>
            </FormField>
            <FormField label="Wt">
              <Input type="number" min={1} max={9} value={newBand.aggregate_weight} onChange={(e) => setNewBand((d) => ({ ...d, aggregate_weight: e.target.value }))} className={`w-14 ${compact}`} />
            </FormField>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <FormField label="Class teacher comment">
              <textarea
                value={newBand.class_teacher_comment}
                onChange={(e) => setNewBand((d) => ({ ...d, class_teacher_comment: e.target.value }))}
                rows={3}
                maxLength={2000}
                className={commentArea}
              />
            </FormField>
            <FormField label="Head teacher comment">
              <textarea
                value={newBand.head_teacher_comment}
                onChange={(e) => setNewBand((d) => ({ ...d, head_teacher_comment: e.target.value }))}
                rows={3}
                maxLength={2000}
                className={commentArea}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={creating} onClick={() => void addBand()}>Add band</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void (async () => {
                  if (!window.confirm(`Delete the "${scale.name}" scale?`)) return;
                  try {
                    await deleteScale(scale.id).unwrap();
                    toast("Scale deleted.", "success");
                  } catch (err) {
                    const p = parseError(err);
                    toast(p.message, "error", p.requestId);
                  }
                })()
              }
            >
              Delete scale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectScaleRow({
  subject,
  scales,
}: {
  subject: SubjectGradingOut;
  scales: GradingScaleOut[];
}) {
  const { toast } = useToast();
  const [assignScale] = useAssignSubjectGradingScaleMutation();

  async function onChange(scaleId: string) {
    try {
      await assignScale({
        subjectId: subject.subject_id,
        grading_scale_id: scaleId || null,
      }).unwrap();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <tr className="border-b border-slate-50">
      <td className="px-2 py-2 font-mono text-[11px]">{subject.subject_code}</td>
      <td className="px-2 py-2">{subject.subject_name}</td>
      <td className="px-2 py-2">
        <Select
          value={subject.grading_scale_id ?? ""}
          onChange={(e) => void onChange(e.target.value)}
          className={`max-w-xs ${compact}`}
        >
          <option value="">Not assigned</option>
          {scales.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </td>
    </tr>
  );
}

function CycleSection({ section }: { section: CycleGradingSectionOut }) {
  const { toast } = useToast();
  const [createScale, { isLoading: creating }] = useCreateGradingScaleMutation();
  const [scaleName, setScaleName] = useState("");
  const meta = NCDC_CYCLE_LABELS[section.cycle as NcdcCycle];

  async function addScale() {
    if (!scaleName.trim()) return;
    try {
      await createScale({
        name: scaleName.trim(),
        ncdc_cycle: section.cycle,
      }).unwrap();
      setScaleName("");
      toast("Grading scale created.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title={section.cycle_label}
        description={meta ? `${meta.title} · ${meta.grades}` : section.cycle}
        action={
          <Badge tone="neutral">
            {section.subjects.length} subject{section.subjects.length === 1 ? "" : "s"}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Grading scales
          </h4>
          {section.scales.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Create a scale for this section — e.g. &quot;Standard PLE&quot; or &quot;Creative Arts&quot; for special subjects.
            </p>
          ) : (
            <div className="space-y-2">
              {section.scales.map((scale) => (
                <ScalePanel key={scale.id} scale={scale} />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <FormField label="New scale name" required>
              <Input
                value={scaleName}
                onChange={(e) => setScaleName(e.target.value)}
                placeholder="Standard PLE"
                className={`w-48 ${compact}`}
              />
            </FormField>
            <Button size="sm" variant="secondary" loading={creating} onClick={() => void addScale()}>
              Add scale
            </Button>
          </div>
        </div>

        {section.subjects.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Subject assignments
            </h4>
            <p className="mb-2 text-[11px] text-slate-400">
              Most subjects share one scale; assign a different scale for special subjects.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Grading scale</th>
                  </tr>
                </thead>
                <tbody>
                  {section.subjects.map((subject) => (
                    <SubjectScaleRow key={subject.subject_id} subject={subject} scales={section.scales} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section.subjects.length === 0 && (
          <p className="text-[11px] text-slate-400">
            No subjects in this section yet. Add them under Settings → Subjects with the {section.cycle_label} cycle tag.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function DivisionRow({ division }: { division: AggregateDivisionOut }) {
  const { toast } = useToast();
  const [updateDivision, { isLoading: saving }] = useUpdateAggregateDivisionMutation();
  const [deleteDivision] = useDeleteAggregateDivisionMutation();
  const [draft, setDraft] = useState({
    label: division.label,
    min_aggregate: String(division.min_aggregate),
    max_aggregate: String(division.max_aggregate),
    class_teacher_comment: division.class_teacher_comment ?? "",
    head_teacher_comment: division.head_teacher_comment ?? "",
  });

  async function save() {
    try {
      await updateDivision({
        divisionId: division.id,
        body: {
          label: draft.label.trim(),
          min_aggregate: Number(draft.min_aggregate),
          max_aggregate: Number(draft.max_aggregate),
          class_teacher_comment: draft.class_teacher_comment.trim() || null,
          head_teacher_comment: draft.head_teacher_comment.trim() || null,
        },
      }).unwrap();
      toast("Saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <tr className="border-b border-slate-50 align-top">
      <td className="px-2 py-2"><Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className={compact} /></td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <Input type="number" value={draft.min_aggregate} onChange={(e) => setDraft((d) => ({ ...d, min_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
          <span className="text-slate-300">–</span>
          <Input type="number" value={draft.max_aggregate} onChange={(e) => setDraft((d) => ({ ...d, max_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
        </div>
      </td>
      <td className="min-w-[12rem] px-2 py-2">
        <textarea
          value={draft.class_teacher_comment}
          onChange={(e) => setDraft((d) => ({ ...d, class_teacher_comment: e.target.value }))}
          rows={3}
          maxLength={2000}
          className={commentArea}
        />
      </td>
      <td className="min-w-[12rem] px-2 py-2">
        <textarea
          value={draft.head_teacher_comment}
          onChange={(e) => setDraft((d) => ({ ...d, head_teacher_comment: e.target.value }))}
          rows={3}
          maxLength={2000}
          className={commentArea}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void save()}>Save</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void (async () => {
                try {
                  await deleteDivision(division.id).unwrap();
                  toast("Division removed.", "success");
                } catch (err) {
                  const p = parseError(err);
                  toast(p.message, "error", p.requestId);
                }
              })()
            }
          >
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function GradingSettingsView() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch, isFetching } = useGetGradingConfigQuery();
  const [createDivision, { isLoading: creatingDivision }] = useCreateAggregateDivisionMutation();
  const [newDivision, setNewDivision] = useState({
    label: "",
    min_aggregate: "4",
    max_aggregate: "12",
    class_teacher_comment: "",
    head_teacher_comment: "",
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <ErrorBanner message="Couldn't load grading configuration. Please refresh and try again." />
    );

  const totalSubjects = data.sections.reduce((n, s) => n + s.subjects.length, 0);

  async function addDivision() {
    if (!newDivision.label.trim()) return;
    try {
      await createDivision({
        label: newDivision.label.trim(),
        min_aggregate: Number(newDivision.min_aggregate),
        max_aggregate: Number(newDivision.max_aggregate),
        class_teacher_comment: newDivision.class_teacher_comment.trim() || null,
        head_teacher_comment: newDivision.head_teacher_comment.trim() || null,
      }).unwrap();
      setNewDivision({
        label: "",
        min_aggregate: "4",
        max_aggregate: "12",
        class_teacher_comment: "",
        head_teacher_comment: "",
      });
      toast("Division added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <SettingsHint>
          Grading is organised by curriculum section (P1–P3, P4, P5–P7). Create named scales per section,
          define grade bands once per scale, then assign subjects — most share a scale; special subjects
          can use their own. For each band, set class teacher and head teacher comments — report cards
          pick the matching remarks automatically from the learner&apos;s term performance.
        </SettingsHint>
        <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh grading" />
      </div>

      {totalSubjects === 0 ? (
        <EmptyState
          icon={<Icon name="book" size={18} />}
          title="Add subjects first"
          description="Create subjects under Settings → Subjects, tagged to P1–P3, P4, or P5–P7. They will appear in the matching section here."
          action={
            <Link href="/app/settings/subjects">
              <Button size="sm">Go to subjects</Button>
            </Link>
          }
        />
      ) : (
        data.sections.map((section) => (
          <CycleSection key={section.cycle} section={section} />
        ))
      )}

      <Card>
        <CardHeader title="Aggregate divisions (PLE)" description="Overall PLE aggregate bands — class and head teacher comments apply to P7 report cards." />
        <CardBody className="space-y-3">
          {data.aggregate_divisions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">Division</th>
                    <th className="px-2 py-2">Aggregate</th>
                    <th className="px-2 py-2">Class teacher comment</th>
                    <th className="px-2 py-2">Head teacher comment</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aggregate_divisions.map((d) => (
                    <DivisionRow key={d.id} division={d} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <FormField label="Division" required>
              <Input value={newDivision.label} onChange={(e) => setNewDivision((d) => ({ ...d, label: e.target.value }))} placeholder="Division I" className={`w-32 ${compact}`} />
            </FormField>
            <FormField label="Aggregate" required>
              <div className="flex items-center gap-1">
                <Input type="number" value={newDivision.min_aggregate} onChange={(e) => setNewDivision((d) => ({ ...d, min_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
                <span className="text-slate-300">–</span>
                <Input type="number" value={newDivision.max_aggregate} onChange={(e) => setNewDivision((d) => ({ ...d, max_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
              </div>
            </FormField>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <FormField label="Class teacher comment">
              <textarea
                value={newDivision.class_teacher_comment}
                onChange={(e) => setNewDivision((d) => ({ ...d, class_teacher_comment: e.target.value }))}
                rows={3}
                maxLength={2000}
                className={commentArea}
              />
            </FormField>
            <FormField label="Head teacher comment">
              <textarea
                value={newDivision.head_teacher_comment}
                onChange={(e) => setNewDivision((d) => ({ ...d, head_teacher_comment: e.target.value }))}
                rows={3}
                maxLength={2000}
                className={commentArea}
              />
            </FormField>
          </div>
          <Button size="sm" variant="secondary" loading={creatingDivision} onClick={() => void addDivision()}>Add division</Button>
        </CardBody>
      </Card>
    </div>
  );
}
