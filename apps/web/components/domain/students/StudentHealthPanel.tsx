"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { StudentHealthOut } from "@/lib/types";
import { useUpsertStudentHealthMutation } from "@/store/api/skulpulseApi";
import { BLOOD_GROUP_OPTIONS } from "./studentOptions";

const compactControl = "h-7 text-[12px]";

const FIELDS: { key: keyof StudentHealthOut; label: string; area?: boolean }[] = [
  { key: "allergies", label: "Allergies", area: true },
  { key: "chronic_conditions", label: "Chronic conditions", area: true },
  { key: "medications", label: "Regular medications", area: true },
  { key: "disabilities", label: "Disabilities / special needs", area: true },
  { key: "dietary_needs", label: "Dietary needs" },
  { key: "doctor_name", label: "Doctor name" },
  { key: "doctor_phone", label: "Doctor phone" },
  { key: "insurance_provider", label: "Insurance provider" },
  { key: "insurance_number", label: "Insurance number" },
  { key: "emergency_notes", label: "Emergency notes", area: true },
];

type HealthForm = Record<string, string>;

function fromHealth(health: StudentHealthOut | null | undefined): HealthForm {
  const form: HealthForm = { blood_group: health?.blood_group ?? "" };
  for (const f of FIELDS) form[f.key] = (health?.[f.key] as string | null | undefined) ?? "";
  return form;
}

interface StudentHealthPanelProps {
  studentId: string;
  health: StudentHealthOut | null | undefined;
  isAdmin: boolean;
}

export function StudentHealthPanel({ studentId, health, isAdmin }: StudentHealthPanelProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<HealthForm>(fromHealth(health));
  const [upsert, { isLoading }] = useUpsertStudentHealthMutation();

  function startEdit() {
    setForm(fromHealth(health));
    setEditing(true);
  }

  async function save() {
    try {
      const body: Record<string, unknown> = { blood_group: form.blood_group || null };
      for (const f of FIELDS) body[f.key] = form[f.key].trim() || null;
      await upsert({ studentId, body }).unwrap();
      toast("Health profile saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const hasData =
    health && (health.blood_group || FIELDS.some((f) => health[f.key]));

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">Medical &amp; emergency profile</p>
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Icon name="heart" size={12} />
              {hasData ? "Edit health" : "Add health info"}
            </Button>
          )}
        </div>
        {!hasData ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-[12px] text-slate-400">
            No health information recorded yet.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between gap-3 border-b border-slate-50 py-1">
              <dt className="text-[11px] text-slate-400">Blood group</dt>
              <dd className="text-right text-[12px] font-medium text-slate-700">
                {health?.blood_group || "—"}
              </dd>
            </div>
            {FIELDS.map((f) =>
              health?.[f.key] ? (
                <div key={f.key} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                  <dt className="text-[11px] text-slate-400">{f.label}</dt>
                  <dd className="text-right text-[12px] text-slate-700">{health[f.key] as string}</dd>
                </div>
              ) : null,
            )}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <FormField label="Blood group">
          <Select
            value={form.blood_group}
            onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))}
            className={compactControl}
          >
            <option value="">—</option>
            {BLOOD_GROUP_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </FormField>
        {FIELDS.map((f) => (
          <FormField key={f.key} label={f.label}>
            <Input
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className={compactControl}
            />
          </FormField>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" loading={isLoading} onClick={() => void save()}>
          Save health profile
        </Button>
      </div>
    </div>
  );
}
