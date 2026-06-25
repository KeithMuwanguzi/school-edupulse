"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import type { ClassOut } from "@/lib/types";
import { useBulkAssignStudentsMutation } from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

const compactControl = "h-7 text-[12px]";

interface StudentBulkMoveBarProps {
  selectedIds: string[];
  classes: ClassOut[];
  onClear: () => void;
  onDone: () => void;
}

export function StudentBulkMoveBar({
  selectedIds,
  classes,
  onClear,
  onDone,
}: StudentBulkMoveBarProps) {
  const { toast } = useToast();
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [bulkAssign, { isLoading }] = useBulkAssignStudentsMutation();

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  async function move() {
    if (!classId) {
      toast("Choose a class to move students into.", "error");
      return;
    }
    try {
      const res = await bulkAssign({
        student_ids: selectedIds,
        class_id: classId,
        stream_id: streamId || undefined,
      }).unwrap();
      toast(`${res.updated} student(s) moved.`, "success");
      onDone();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function unassign() {
    try {
      const res = await bulkAssign({
        student_ids: selectedIds,
        clear_class: true,
      }).unwrap();
      toast(`${res.updated} student(s) unassigned.`, "success");
      onDone();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/40 px-3 py-2">
      <span className="text-[11px] font-medium text-brand-800">
        {selectedIds.length} selected
      </span>
      <Select
        value={classId}
        onChange={(e) => {
          setClassId(e.target.value);
          setStreamId("");
        }}
        className={`w-28 ${compactControl}`}
        aria-label="Move to class"
      >
        <option value="">Class…</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.level}
          </option>
        ))}
      </Select>
      {streams.length > 0 && (
        <Select
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          className={`w-24 ${compactControl}`}
          aria-label="Stream"
        >
          <option value="">Stream</option>
          {streams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      <Button size="sm" variant="secondary" loading={isLoading} onClick={() => void move()}>
        Move
      </Button>
      <button
        type="button"
        onClick={() => void unassign()}
        disabled={isLoading}
        className="text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
      >
        Unassign
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[11px] text-slate-400 hover:text-slate-600"
      >
        Clear
      </button>
    </div>
  );
}
