"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import {
  AGGREGATE_GRADE_OPTIONS,
  bandByAggregateWeight,
  formatMarkRange,
} from "@/lib/gradingTemplates";
import type { GradeRangeOut, GradingScaleOut } from "@/lib/types";
import {
  useCreateScaleGradeRangeMutation,
  useDeleteGradingScaleMutation,
  useDeleteScaleGradeRangeMutation,
  useUpdateGradingScaleMutation,
  useUpdateScaleGradeRangeMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";

const compact = "h-7 text-[12px]";

function RangeRow({ scaleId, range }: { scaleId: string; range: GradeRangeOut }) {
  const { toast } = useToast();
  const [updateRange, { isLoading: saving }] = useUpdateScaleGradeRangeMutation();
  const [deleteRange] = useDeleteScaleGradeRangeMutation();
  const [editMarks, setEditMarks] = useState(false);
  const [draft, setDraft] = useState({
    label: range.label,
    aggregate_weight: String(range.aggregate_weight),
    min_mark: String(range.min_mark),
    max_mark: String(range.max_mark),
    comment: range.comment ?? "",
  });

  useEffect(() => {
    setDraft({
      label: range.label,
      aggregate_weight: String(range.aggregate_weight),
      min_mark: String(range.min_mark),
      max_mark: String(range.max_mark),
      comment: range.comment ?? "",
    });
  }, [range]);

  function applyAggregate(weight: number) {
    const template = bandByAggregateWeight(weight);
    setDraft((d) => ({
      ...d,
      aggregate_weight: String(weight),
      label: template?.label ?? d.label,
      comment: template?.comment ?? d.comment,
      min_mark: String(template?.min_mark ?? d.min_mark),
      max_mark: String(template?.max_mark ?? d.max_mark),
    }));
  }

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
          comment: draft.comment.trim() || null,
        },
      }).unwrap();
      toast("Band saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <tr className="border-b border-slate-50 align-top">
      <td className="px-2 py-2">
        <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className={`w-16 ${compact}`} />
      </td>
      <td className="px-2 py-2">
        {editMarks ? (
          <div className="flex items-center gap-1">
            <Input type="number" value={draft.min_mark} onChange={(e) => setDraft((d) => ({ ...d, min_mark: e.target.value }))} className={`w-14 ${compact}`} />
            <span className="text-slate-300">–</span>
            <Input type="number" value={draft.max_mark} onChange={(e) => setDraft((d) => ({ ...d, max_mark: e.target.value }))} className={`w-14 ${compact}`} />
          </div>
        ) : (
          <button
            type="button"
            className="text-[11px] font-medium text-slate-700 underline-offset-2 hover:text-brand-700 hover:underline"
            onClick={() => setEditMarks(true)}
            title="Adjust score range that maps to this grade"
          >
            {formatMarkRange(Number(draft.min_mark), Number(draft.max_mark))}
          </button>
        )}
      </td>
      <td className="px-2 py-2">
        <Input
          value={draft.comment}
          onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
          placeholder="Excellent"
          className={`min-w-[7rem] ${compact}`}
        />
      </td>
      <td className="px-2 py-2">
        <Select
          value={draft.aggregate_weight}
          onChange={(e) => applyAggregate(Number(e.target.value))}
          className={`w-20 ${compact}`}
          title="PLE aggregate weight (optional for lower primary)"
        >
          {AGGREGATE_GRADE_OPTIONS.map((o) => (
            <option key={o.weight} value={o.weight}>
              {o.weight}
            </option>
          ))}
        </Select>
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
                  toast("Band removed.", "success");
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

export function GradingScaleEditor({ scale }: { scale: GradingScaleOut }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [scaleName, setScaleName] = useState(scale.name);
  const [createRange, { isLoading: creating }] = useCreateScaleGradeRangeMutation();
  const [updateScale, { isLoading: renaming }] = useUpdateGradingScaleMutation();
  const [deleteScale] = useDeleteGradingScaleMutation();
  const [newAggregate, setNewAggregate] = useState("1");
  const [newBand, setNewBand] = useState({
    label: "D1",
    aggregate_weight: 1,
    min_mark: 90,
    max_mark: 100,
    comment: "Excellent",
  });

  useEffect(() => {
    const template = bandByAggregateWeight(Number(newAggregate));
    if (!template) return;
    setNewBand({
      label: template.label,
      aggregate_weight: template.aggregate_weight,
      min_mark: template.min_mark,
      max_mark: template.max_mark,
      comment: template.comment,
    });
  }, [newAggregate]);

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
    const weight = Number(newAggregate);
    const template = bandByAggregateWeight(weight);
    const payload = template ?? newBand;
    if (scale.ranges.some((r) => r.aggregate_weight === weight)) {
      toast(`Aggregate ${weight} already exists on this scale.`, "error");
      return;
    }
    try {
      await createRange({
        scaleId: scale.id,
        body: {
          label: payload.label,
          aggregate_weight: weight,
          min_mark: payload.min_mark,
          max_mark: payload.max_mark,
          comment: payload.comment,
        },
      }).unwrap();
      toast("Band added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function deleteScaleConfirmed() {
    const ok = await confirm({
      title: "Delete grading scale",
      description: `Delete "${scale.name}"? Subjects using it will need reassignment.`,
      confirmLabel: "Delete scale",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteScale(scale.id).unwrap();
      toast("Scale deleted.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const usedWeights = new Set(scale.ranges.map((r) => r.aggregate_weight));
  const template = bandByAggregateWeight(Number(newAggregate));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500">
        Define <span className="font-medium text-slate-700">mark ranges</span> first — each band maps a
        score % to a grade label and descriptor on report cards. Aggregate weights (1–9) are used for PLE
        totals; teacher remarks by division are on the Aggregate tab.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <FormField label="Scale name" required>
          <Input
            value={scaleName}
            onChange={(e) => setScaleName(e.target.value)}
            onBlur={() => void saveScaleName()}
            className={`w-full sm:w-56 ${compact}`}
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

      {scale.ranges.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2">Score range</th>
                <th className="px-2 py-2">Descriptor</th>
                <th className="px-2 py-2">Agg</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...scale.ranges]
                .sort((a, b) => a.aggregate_weight - b.aggregate_weight)
                .map((range) => (
                  <RangeRow key={range.id} scaleId={scale.id} range={range} />
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">No bands yet — add by aggregate below or apply the UNEB template.</p>
      )}

      <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Add grade band</p>
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Mark range preset" required>
            <Select
              value={newAggregate}
              onChange={(e) => setNewAggregate(e.target.value)}
              className={`w-44 ${compact}`}
            >
              {AGGREGATE_GRADE_OPTIONS.map((o) => (
                <option key={o.weight} value={o.weight} disabled={usedWeights.has(o.weight)}>
                  {o.label} · {o.markRange} · {o.comment}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Grade">
            <Input value={newBand.label} readOnly className={`w-16 ${compact} bg-slate-50`} />
          </FormField>
          <FormField label="Descriptor">
            <Input
              value={newBand.comment}
              onChange={(e) => setNewBand((d) => ({ ...d, comment: e.target.value }))}
              className={`w-32 ${compact}`}
            />
          </FormField>
          {template && (
            <p className="pb-1 text-[10px] text-slate-500">
              Maps marks {formatMarkRange(template.min_mark, template.max_mark)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={creating}
            disabled={usedWeights.has(Number(newAggregate))}
            onClick={() => void addBand()}
          >
            Add band
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void deleteScaleConfirmed()}>Delete scale</Button>
        </div>
      </div>
    </div>
  );
}
