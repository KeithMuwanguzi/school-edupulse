"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { parseError } from "@/lib/apiError";
import { UNEB_PLE_AGGREGATE_DIVISIONS } from "@/lib/gradingTemplates";
import type { AggregateDivisionOut } from "@/lib/types";
import {
  useCreateAggregateDivisionMutation,
  useDeleteAggregateDivisionMutation,
  useUpdateAggregateDivisionMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

const compact = "h-7 text-[12px]";
const commentArea =
  "w-full min-h-[4.5rem] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

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
      <td className="px-3 py-2"><Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className={compact} /></td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input type="number" value={draft.min_aggregate} onChange={(e) => setDraft((d) => ({ ...d, min_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
          <span className="text-slate-300">–</span>
          <Input type="number" value={draft.max_aggregate} onChange={(e) => setDraft((d) => ({ ...d, max_aggregate: e.target.value }))} className={`w-14 ${compact}`} />
        </div>
      </td>
      <td className="min-w-[12rem] px-3 py-2">
        <textarea value={draft.class_teacher_comment} onChange={(e) => setDraft((d) => ({ ...d, class_teacher_comment: e.target.value }))} rows={2} maxLength={2000} className={commentArea} />
      </td>
      <td className="min-w-[12rem] px-3 py-2">
        <textarea value={draft.head_teacher_comment} onChange={(e) => setDraft((d) => ({ ...d, head_teacher_comment: e.target.value }))} rows={2} maxLength={2000} className={commentArea} />
      </td>
      <td className="px-3 py-2 text-right">
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

export function GradingAggregatePanel({
  divisions,
}: {
  divisions: AggregateDivisionOut[];
}) {
  const { toast } = useToast();
  const [createDivision, { isLoading: creating }] = useCreateAggregateDivisionMutation();
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newDivision, setNewDivision] = useState({
    label: "",
    min_aggregate: "4",
    max_aggregate: "12",
    class_teacher_comment: "",
    head_teacher_comment: "",
  });

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

  async function applyTemplate() {
    setCreatingTemplate(true);
    try {
      for (const div of UNEB_PLE_AGGREGATE_DIVISIONS) {
        await createDivision({
          label: div.label,
          min_aggregate: div.min_aggregate,
          max_aggregate: div.max_aggregate,
          class_teacher_comment: div.class_teacher_comment ?? null,
          head_teacher_comment: div.head_teacher_comment ?? null,
        }).unwrap();
      }
      toast("UNEB aggregate divisions added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    } finally {
      setCreatingTemplate(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Icon name="graduation" size={13} />}
        title="PLE aggregate divisions"
        description="Report-card remarks — class teacher and head teacher comments apply to the whole report, based on overall aggregate."
        action={
          divisions.length === 0 ? (
            <Button size="sm" loading={creatingTemplate} onClick={() => void applyTemplate()}>
              <Icon name="spark" size={13} />
              UNEB template
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {divisions.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2">Aggregate</th>
                  <th className="px-3 py-2">Class teacher</th>
                  <th className="px-3 py-2">Head teacher</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {divisions.map((d) => (
                  <DivisionRow key={d.id} division={d} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Use the UNEB template for Division I–IV and Ungraded, or add divisions manually below.
          </p>
        )}

        <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Add division</p>
          <div className="flex flex-wrap items-end gap-2">
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
              <textarea value={newDivision.class_teacher_comment} onChange={(e) => setNewDivision((d) => ({ ...d, class_teacher_comment: e.target.value }))} rows={2} maxLength={2000} className={commentArea} />
            </FormField>
            <FormField label="Head teacher comment">
              <textarea value={newDivision.head_teacher_comment} onChange={(e) => setNewDivision((d) => ({ ...d, head_teacher_comment: e.target.value }))} rows={2} maxLength={2000} className={commentArea} />
            </FormField>
          </div>
          <Button size="sm" variant="secondary" loading={creating} onClick={() => void addDivision()}>Add division</Button>
        </div>
      </CardBody>
    </Card>
  );
}
