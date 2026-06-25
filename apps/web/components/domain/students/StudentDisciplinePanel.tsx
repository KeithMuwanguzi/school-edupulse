"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { StudentDisciplineOut } from "@/lib/types";
import {
  useAddDisciplineMutation,
  useDeleteDisciplineMutation,
  useUpdateDisciplineMutation,
} from "@/store/api/skulpulseApi";
import {
  DISCIPLINE_CATEGORY_OPTIONS,
  DISCIPLINE_STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  disciplineStatusTone,
  severityTone,
  titleCase,
} from "./studentOptions";

const compactControl = "h-7 text-[12px]";

interface DiscForm {
  incident_date: string;
  category: string;
  severity: string;
  description: string;
  action_taken: string;
  status: string;
}

function emptyForm(): DiscForm {
  return {
    incident_date: new Date().toISOString().slice(0, 10),
    category: "behavior",
    severity: "minor",
    description: "",
    action_taken: "",
    status: "open",
  };
}

function fromRecord(r: StudentDisciplineOut): DiscForm {
  return {
    incident_date: r.incident_date,
    category: r.category,
    severity: r.severity ?? "",
    description: r.description,
    action_taken: r.action_taken ?? "",
    status: r.status,
  };
}

function toBody(form: DiscForm): Record<string, unknown> {
  return {
    incident_date: form.incident_date,
    category: form.category,
    severity: form.severity || null,
    description: form.description.trim(),
    action_taken: form.action_taken.trim() || null,
    status: form.status,
  };
}

interface StudentDisciplinePanelProps {
  studentId: string;
  records: StudentDisciplineOut[];
  isAdmin: boolean;
}

export function StudentDisciplinePanel({ studentId, records, isAdmin }: StudentDisciplinePanelProps) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscForm>(emptyForm());
  const [addDiscipline, { isLoading: creating }] = useAddDisciplineMutation();
  const [updateDiscipline, { isLoading: updating }] = useUpdateDisciplineMutation();
  const [deleteDiscipline] = useDeleteDisciplineMutation();

  function startAdd() {
    setForm(emptyForm());
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(r: StudentDisciplineOut) {
    setForm(fromRecord(r));
    setEditingId(r.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  async function submit() {
    if (!form.description.trim()) {
      toast("Describe the incident.", "error");
      return;
    }
    try {
      if (editingId) {
        await updateDiscipline({ recordId: editingId, body: toBody(form) }).unwrap();
        toast("Incident updated.", "success");
      } else {
        await addDiscipline({ studentId, body: toBody(form) }).unwrap();
        toast("Incident logged.", "success");
      }
      cancel();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove(r: StudentDisciplineOut) {
    if (!window.confirm("Remove this incident?")) return;
    try {
      await deleteDiscipline(r.id).unwrap();
      toast("Incident removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          {records.length} incident{records.length === 1 ? "" : "s"} on record
        </p>
        {isAdmin && !showForm && (
          <Button size="sm" variant="secondary" onClick={startAdd}>
            <Icon name="plus" size={12} />
            Log incident
          </Button>
        )}
      </div>

      {records.length === 0 && !showForm && (
        <EmptyState
          icon={<Icon name="shield" size={18} />}
          title="Clean record"
          description={isAdmin ? "No discipline incidents logged for this learner." : "No incidents recorded."}
        />
      )}

      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-slate-800">
                    {titleCase(r.category)}
                  </span>
                  {r.severity && (
                    <span className={`rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ring-1 ${severityTone(r.severity)}`}>
                      {r.severity}
                    </span>
                  )}
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ring-1 ${disciplineStatusTone(r.status)}`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] text-slate-400">{r.incident_date}</span>
                </div>
                <p className="mt-1 text-[12px] text-slate-600">{r.description}</p>
                {r.action_taken && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-600">Action:</span> {r.action_taken}
                  </p>
                )}
                {r.recorded_by_name && (
                  <p className="mt-0.5 text-[10px] text-slate-400">Logged by {r.recorded_by_name}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="text-[11px] text-slate-400 hover:text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(r)}
                    className="text-[11px] text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/30 p-3">
          <p className="text-[11px] font-semibold text-slate-700">
            {editingId ? "Edit incident" : "Log incident"}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Date" required>
              <Input
                type="date"
                value={form.incident_date}
                onChange={(e) => setForm((f) => ({ ...f, incident_date: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Category" required>
              <Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={compactControl}
              >
                {DISCIPLINE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Severity">
              <Select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                className={compactControl}
              >
                <option value="">—</option>
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={compactControl}
              >
                {DISCIPLINE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Description" required>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={compactControl}
              placeholder="What happened?"
            />
          </FormField>
          <FormField label="Action taken" hint="Optional">
            <Input
              value={form.action_taken}
              onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))}
              className={compactControl}
            />
          </FormField>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" loading={creating || updating} onClick={() => void submit()}>
              {editingId ? "Save incident" : "Log incident"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
