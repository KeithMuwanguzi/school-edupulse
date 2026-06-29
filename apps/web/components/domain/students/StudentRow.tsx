"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import type { ClassOut, StudentOut } from "@/lib/types";
import {
  useDeleteStudentMutation,
  useListClassesQuery,
  useUpdateStudentMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { STUDENT_NAME_LABELS, formatStudentFullName } from "./studentOptions";

const compactControl = "h-7 text-[12px]";

function formatClassPlacement(student: StudentOut): string {
  if (!student.class_level) return "Unassigned";
  const base = student.class_level;
  return student.stream_name ? `${base} · ${student.stream_name}` : base;
}

interface StudentRowProps {
  student: StudentOut;
  classes: ClassOut[];
}

export function StudentRow({ student, classes }: StudentRowProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [lin, setLin] = useState(student.lin ?? "");
  const [classId, setClassId] = useState(student.class_id ?? "");
  const [streamId, setStreamId] = useState(student.stream_id ?? "");
  const [active, setActive] = useState(student.is_active);
  const [updateStudent, { isLoading: saving }] = useUpdateStudentMutation();
  const [deleteStudent, { isLoading: deleting }] = useDeleteStudentMutation();

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  useEffect(() => {
    setFirstName(student.first_name);
    setLastName(student.last_name);
    setLin(student.lin ?? "");
    setClassId(student.class_id ?? "");
    setStreamId(student.stream_id ?? "");
    setActive(student.is_active);
    setEditing(false);
  }, [
    student.id,
    student.first_name,
    student.last_name,
    student.lin,
    student.class_id,
    student.stream_id,
    student.is_active,
  ]);

  useEffect(() => {
    if (!classId) setStreamId("");
    else if (streamId && !streams.some((s) => s.id === streamId)) setStreamId("");
  }, [classId, streamId, streams]);

  function cancel() {
    setFirstName(student.first_name);
    setLastName(student.last_name);
    setLin(student.lin ?? "");
    setClassId(student.class_id ?? "");
    setStreamId(student.stream_id ?? "");
    setActive(student.is_active);
    setEditing(false);
  }

  async function save() {
    try {
      await updateStudent({
        studentId: student.id,
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          lin: lin.trim() || null,
          class_id: classId || null,
          stream_id: streamId || null,
          clear_class: !classId,
          is_active: active,
        },
      }).unwrap();
      toast("Student saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Remove learner",
      description: `Remove ${student.student_number} from the register? This cannot be undone.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteStudent(student.id).unwrap();
      toast("Student removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const fullName = formatStudentFullName(student);

  if (!editing) {
    return (
      <div className="group flex items-center gap-2 border-b border-slate-50 px-3 py-1.5 last:border-0 hover:bg-slate-50/60">
        <span className="w-14 shrink-0 font-mono text-[10px] font-medium text-slate-400">
          {student.student_number}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[12px] ${
            student.is_active ? "text-slate-700" : "text-slate-400"
          }`}
        >
          {fullName}
        </span>
        <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
          {formatClassPlacement(student)}
        </span>
        {student.guardian && (
          <span className="hidden shrink-0 text-[10px] text-slate-300 lg:inline">
            Guardian linked
          </span>
        )}
        {!student.is_active && (
          <span className="shrink-0 text-[10px] text-slate-300">Off</span>
        )}
        <div className="flex shrink-0 items-center gap-2 opacity-70 transition group-hover:opacity-100">
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
    );
  }

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-2 last:border-0">
      <div className="flex flex-wrap items-end gap-2">
        <span className="w-14 shrink-0 pb-1 font-mono text-[10px] font-medium text-slate-500">
          {student.student_number}
        </span>
        <Input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={`min-w-[6rem] flex-1 ${compactControl}`}
          aria-label={STUDENT_NAME_LABELS.last_name}
          placeholder={STUDENT_NAME_LABELS.last_name}
        />
        <Input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={`min-w-[6rem] flex-1 ${compactControl}`}
          aria-label={STUDENT_NAME_LABELS.first_name}
          placeholder={STUDENT_NAME_LABELS.first_name}
        />
        <Input
          value={lin}
          onChange={(e) => setLin(e.target.value)}
          className={`w-28 ${compactControl}`}
          aria-label="LIN"
          placeholder="LIN"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[3.75rem]">
        <Select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={`w-32 ${compactControl}`}
          aria-label="Class"
        >
          <option value="">Unassigned</option>
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
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Active
        </label>
        {student.guardian && (
          <span className="text-[10px] text-slate-400">
            Guardian: {student.guardian.username}
          </span>
        )}
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
