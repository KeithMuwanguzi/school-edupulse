"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  catalogForCycle,
  NCDC_CYCLE_LABELS,
  recommendedForCycle,
  type NcdcSubjectSuggestion,
} from "@/lib/ncdcSubjectCatalog";
import { subjectByCode, subjectHasCycle } from "@/lib/subjectCycleUtils";
import type { NcdcCycle, SubjectOut } from "@/lib/types";

const CUSTOM_VALUE = "__custom__";
const compactControl = "h-7 text-[12px]";

const CYCLE_OPTIONS: { value: NcdcCycle; label: string }[] = [
  { value: "cycle_1", label: "P1–P3" },
  { value: "cycle_2", label: "P4" },
  { value: "cycle_3", label: "P5–P7" },
];

function formatOption(item: NcdcSubjectSuggestion, suffix?: string): string {
  const tags = [item.code];
  if (item.ple) tags.push("PLE");
  const base = `${item.name} (${tags.join(" · ")})`;
  return suffix ? `${base} — ${suffix}` : base;
}

const CORE_PREFIXES = ["ENG", "MTC", "MATH", "SCI", "SST", "SOCIAL"];

function defaultIsCore(code: string, ple?: boolean): boolean {
  if (ple) return true;
  const normalized = code.replace(/\s/g, "").toUpperCase();
  return CORE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

interface SubjectAddPanelProps {
  subjects: SubjectOut[];
  creating: boolean;
  onAdd: (payload: { code: string; name: string; cycle: NcdcCycle; is_core?: boolean }) => Promise<void>;
  onBulkAdd: (items: NcdcSubjectSuggestion[]) => Promise<void>;
  onClose?: () => void;
}

export function SubjectAddPanel({
  subjects,
  creating,
  onAdd,
  onBulkAdd,
  onClose,
}: SubjectAddPanelProps) {
  const [cycle, setCycle] = useState<NcdcCycle>("cycle_3");
  const [pick, setPick] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [isCore, setIsCore] = useState(true);

  const cycleMeta = NCDC_CYCLE_LABELS[cycle];
  const isCustom = pick === CUSTOM_VALUE;

  const { recommendedAvailable, otherAvailable, extendable, complete } = useMemo(() => {
    const recCodes = new Set(recommendedForCycle(cycle).map((s) => s.code));
    const recommendedAvailable: NcdcSubjectSuggestion[] = [];
    const otherAvailable: NcdcSubjectSuggestion[] = [];
    const extendable: NcdcSubjectSuggestion[] = [];
    const complete: NcdcSubjectSuggestion[] = [];

    for (const item of catalogForCycle(cycle)) {
      const existing = subjectByCode(subjects, item.code);
      if (!existing) {
        if (recCodes.has(item.code)) recommendedAvailable.push(item);
        else otherAvailable.push(item);
      } else if (subjectHasCycle(existing, cycle)) {
        complete.push(item);
      } else {
        extendable.push(item);
      }
    }

    return { recommendedAvailable, otherAvailable, extendable, complete };
  }, [cycle, subjects]);

  const missingRecommended = useMemo(
    () =>
      recommendedForCycle(cycle).filter((item) => {
        const existing = subjectByCode(subjects, item.code);
        return !existing || !subjectHasCycle(existing, cycle);
      }),
    [cycle, subjects],
  );

  const pickedItem = useMemo(
    () => catalogForCycle(cycle).find((s) => s.code === pick),
    [cycle, pick],
  );

  const pickedExisting = pickedItem ? subjectByCode(subjects, pickedItem.code) : undefined;

  useEffect(() => {
    setPick("");
    setCustomCode("");
    setCustomName("");
    setIsCore(true);
  }, [cycle]);

  useEffect(() => {
    if (isCustom) {
      setIsCore(defaultIsCore(customCode));
      return;
    }
    if (pickedItem) {
      setIsCore(defaultIsCore(pickedItem.code, pickedItem.ple));
    }
  }, [isCustom, customCode, pickedItem]);

  async function submit() {
    if (isCustom) {
      const code = customCode.trim().toUpperCase();
      const name = customName.trim();
      if (!code || !name) return;
      await onAdd({ code, name, cycle, is_core: isCore });
      setCustomCode("");
      setCustomName("");
      setPick("");
      return;
    }

    if (!pickedItem) return;
    await onAdd({
      code: pickedItem.code,
      name: pickedExisting?.name ?? pickedItem.name,
      cycle,
      is_core: isCore,
    });
    setPick("");
  }

  const existingCustom = customCode.trim()
    ? subjectByCode(subjects, customCode.trim())
    : undefined;

  const canSubmit = isCustom
    ? customCode.trim().length >= 2 &&
      customName.trim().length >= 2 &&
      !(existingCustom && subjectHasCycle(existingCustom, cycle))
    : Boolean(pickedItem) &&
      (!pickedExisting || !subjectHasCycle(pickedExisting, cycle));

  const contextHint =
    pickedItem && !isCustom && pickedExisting
      ? `${pickedExisting.code} will also apply to ${cycleMeta.short}.`
      : pickedItem && !isCustom && !pickedExisting
        ? `New ${pickedItem.code} for ${cycleMeta.short}.`
        : existingCustom &&
            !subjectHasCycle(existingCustom, cycle) &&
            isCustom &&
            customCode.trim()
          ? `${existingCustom.code} will also apply to ${cycleMeta.short}.`
          : null;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-[7rem_1fr]">
        <FormField label="Cycle" required>
          <Select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as NcdcCycle)}
            className={compactControl}
          >
            {CYCLE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Subject" required={!isCustom}>
          <Select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={creating}
            className={compactControl}
          >
            <option value="">Select…</option>
            {recommendedAvailable.length > 0 && (
              <optgroup label={`Recommended · ${cycleMeta.short}`}>
                {recommendedAvailable.map((item) => (
                  <option key={item.code} value={item.code}>
                    {formatOption(item)}
                  </option>
                ))}
              </optgroup>
            )}
            {extendable.length > 0 && (
              <optgroup label={`Already in catalogue · add to ${cycleMeta.short}`}>
                {extendable.map((item) => (
                  <option key={`ext-${item.code}`} value={item.code}>
                    {formatOption(item, `also in ${cycleMeta.short}`)}
                  </option>
                ))}
              </optgroup>
            )}
            {otherAvailable.length > 0 && (
              <optgroup label="Other">
                {otherAvailable.map((item) => (
                  <option key={item.code} value={item.code}>
                    {formatOption(item)}
                  </option>
                ))}
              </optgroup>
            )}
            {complete.length > 0 && (
              <optgroup label={`In ${cycleMeta.short}`}>
                {complete.map((item) => (
                  <option key={`done-${item.code}`} value={item.code} disabled>
                    {formatOption(item)} — added
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Manual">
              <option value={CUSTOM_VALUE}>Other…</option>
            </optgroup>
          </Select>
        </FormField>
      </div>

      {isCustom && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <FormField label="Code" required>
            <Input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="ENG"
              maxLength={20}
              className={compactControl}
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="English"
              maxLength={120}
              className={compactControl}
            />
          </FormField>
        </div>
      )}

      {existingCustom && subjectHasCycle(existingCustom, cycle) && isCustom && customCode.trim() && (
        <p className="text-[10px] text-amber-700">Already in {cycleMeta.short}.</p>
      )}

      {contextHint && <p className="text-[10px] text-slate-400">{contextHint}</p>}

      <label className="flex items-center gap-2 text-[11px] text-slate-600">
        <input
          type="checkbox"
          checked={isCore}
          onChange={(e) => setIsCore(e.target.checked)}
          disabled={creating}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
        />
        Core subject (counts toward aggregate / PLE)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" loading={creating} disabled={!canSubmit} onClick={() => void submit()}>
          {pickedExisting && !isCustom ? "Add to cycle" : "Add"}
        </Button>
        {missingRecommended.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            loading={creating}
            onClick={() => void onBulkAdd(missingRecommended)}
          >
            All recommended · {cycleMeta.short}
          </Button>
        )}
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
