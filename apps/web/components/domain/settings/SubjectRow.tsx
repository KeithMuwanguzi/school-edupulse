"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { parseError } from "@/lib/apiError";
import {
  CYCLE_TOGGLE_OPTIONS,
  formatCycleLabels,
} from "@/lib/subjectCycleUtils";
import type { NcdcCycle, SubjectOut } from "@/lib/types";
import {
  useDeleteSubjectMutation,
  useUpdateSubjectMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { useAppSelector } from "@/store/hooks";
import { InlineAssignmentManager } from "@/components/domain/teachers/InlineAssignmentManager";

const CYCLE_ORDER: NcdcCycle[] = ["cycle_1", "cycle_2", "cycle_3"];

interface SubjectRowProps {
  subject: SubjectOut;
}

export function SubjectRow({ subject }: SubjectRowProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showTeachers, setShowTeachers] = useState(false);
  const [name, setName] = useState(subject.name);
  const [cycles, setCycles] = useState<NcdcCycle[]>(subject.ncdc_cycles);
  const [active, setActive] = useState(subject.is_active);
  const [core, setCore] = useState(subject.is_core);
  const [updateSubject, { isLoading: saving }] = useUpdateSubjectMutation();
  const [deleteSubject, { isLoading: deleting }] = useDeleteSubjectMutation();
  const isAdmin = useAppSelector((s) => s.auth.user?.role === "school_admin");
  const hasTeachers = useAppSelector((s) => s.auth.user?.modules.includes("teachers") ?? false);

  useEffect(() => {
    setName(subject.name);
    setCycles(subject.ncdc_cycles);
    setActive(subject.is_active);
    setCore(subject.is_core);
    setEditing(false);
  }, [subject.id, subject.name, subject.ncdc_cycles, subject.is_active, subject.is_core]);

  function toggleCycle(cycle: NcdcCycle) {
    setCycles((prev) => {
      if (prev.includes(cycle)) {
        const next = prev.filter((c) => c !== cycle);
        return next.length > 0 ? next : prev;
      }
      return [...prev, cycle].sort(
        (a, b) => CYCLE_ORDER.indexOf(a) - CYCLE_ORDER.indexOf(b),
      );
    });
  }

  function cancel() {
    setName(subject.name);
    setCycles(subject.ncdc_cycles);
    setActive(subject.is_active);
    setCore(subject.is_core);
    setEditing(false);
  }

  async function save() {
    try {
      await updateSubject({
        subjectId: subject.id,
        body: { name: name.trim(), ncdc_cycles: cycles, is_active: active, is_core: core },
      }).unwrap();
      toast("Subject saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${subject.code}?`)) return;
    try {
      await deleteSubject(subject.id).unwrap();
      toast("Subject removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (!editing) {
    return (
      <div className="border-b border-slate-50 last:border-0">
        <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50/60">
          <span className="w-9 shrink-0 font-mono text-[10px] font-medium text-slate-400">
            {subject.code}
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-[12px] ${
              subject.is_active ? "text-slate-700" : "text-slate-400"
            }`}
          >
            {subject.name}
          </span>
          <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
            {formatCycleLabels(subject.ncdc_cycles)}
          </span>
          {subject.is_core && (
            <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-px text-[9px] font-medium text-brand-700 ring-1 ring-brand-100">
              Core
            </span>
          )}
          {!subject.is_active && (
            <span className="shrink-0 text-[10px] text-slate-300">Off</span>
          )}
          <div className="flex shrink-0 items-center gap-2 opacity-70 transition group-hover:opacity-100">
            {hasTeachers && (
              <button
                type="button"
                onClick={() => setShowTeachers((v) => !v)}
                className={`text-[11px] ${showTeachers ? "text-brand-700" : "text-slate-400 hover:text-brand-700"}`}
              >
                Teachers
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-slate-400 hover:text-brand-700"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className="text-[11px] text-slate-400 hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
        {hasTeachers && showTeachers && (
          <div className="px-3 pb-2 pl-9">
            <InlineAssignmentManager
              scope={{ kind: "subject", subjectId: subject.id, cycles: subject.ncdc_cycles }}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-2 last:border-0">
      <div className="flex flex-wrap items-end gap-2">
        <span className="w-9 shrink-0 pb-1 font-mono text-[10px] font-medium text-slate-500">
          {subject.code}
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 min-w-[8rem] flex-1 text-[12px]"
          aria-label="Subject name"
        />
        <label className="flex shrink-0 items-center gap-1 pb-1 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Active
        </label>
        <label className="flex shrink-0 items-center gap-1 pb-1 text-[11px] text-slate-500" title="Counted toward the term aggregate / division">
          <input
            type="checkbox"
            checked={core}
            onChange={(e) => setCore(e.target.checked)}
            className="rounded border-slate-300"
          />
          Core
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
        {CYCLE_TOGGLE_OPTIONS.map((opt) => {
          const on = cycles.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleCycle(opt.value)}
              className={
                on
                  ? "rounded-full bg-brand-50 px-2 py-px text-[10px] font-medium text-brand-800 ring-1 ring-brand-100"
                  : "rounded-full px-2 py-px text-[10px] text-slate-400 ring-1 ring-slate-200 hover:text-slate-600"
              }
            >
              {opt.label}
            </button>
          );
        })}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
