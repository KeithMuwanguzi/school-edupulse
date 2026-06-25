"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { NcdcCycle } from "@/lib/types";
import {
  useCreateTeacherAssignmentMutation,
  useDeleteTeacherAssignmentMutation,
  useListClassesQuery,
  useListSubjectsQuery,
  useListTeacherAssignmentsQuery,
  useListTeacherStaffQuery,
  useUpdateTeacherAssignmentMutation,
} from "@/store/api/skulpulseApi";

const LEVEL_CYCLE: Record<string, NcdcCycle> = {
  P1: "cycle_1",
  P2: "cycle_1",
  P3: "cycle_1",
  P4: "cycle_2",
  P5: "cycle_3",
  P6: "cycle_3",
  P7: "cycle_3",
};

type Scope =
  | { kind: "subject"; subjectId: string; cycles: NcdcCycle[] }
  | {
      kind: "class";
      classId: string;
      level: string;
      streams: { id: string; name: string; is_active: boolean }[];
    };

interface InlineAssignmentManagerProps {
  scope: Scope;
  isAdmin: boolean;
}

const control = "h-7 text-[12px]";

export function InlineAssignmentManager({ scope, isAdmin }: InlineAssignmentManagerProps) {
  const { toast } = useToast();
  const { data: staff = [] } = useListTeacherStaffQuery();
  const { data: classes = [] } = useListClassesQuery();
  const { data: subjects = [] } = useListSubjectsQuery();
  const { data: allAssignments = [], isLoading } = useListTeacherAssignmentsQuery(
    scope.kind === "class" ? { classId: scope.classId } : undefined,
  );
  const [createAssignment, { isLoading: creating }] = useCreateTeacherAssignmentMutation();
  const [deleteAssignment, { isLoading: deleting }] = useDeleteTeacherAssignmentMutation();
  const [updateAssignment, { isLoading: updating }] = useUpdateTeacherAssignmentMutation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [otherId, setOtherId] = useState(""); // class (subject scope) or subject (class scope)
  const [streamId, setStreamId] = useState("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  const assignments = useMemo(
    () =>
      scope.kind === "subject"
        ? allAssignments.filter((a) => a.subject_id === scope.subjectId)
        : allAssignments,
    [allAssignments, scope],
  );

  // Eligible options for the "other" dropdown, honouring NCDC cycle rules.
  const eligibleClasses = useMemo(() => {
    if (scope.kind !== "subject") return [];
    return classes.filter((c) => scope.cycles.includes(LEVEL_CYCLE[c.level]));
  }, [classes, scope]);

  const eligibleSubjects = useMemo(() => {
    if (scope.kind !== "class") return [];
    const cycle = LEVEL_CYCLE[scope.level];
    return subjects.filter((s) => s.is_active && s.ncdc_cycles.includes(cycle));
  }, [subjects, scope]);

  // Streams available for the chosen placement.
  const streamOptions = useMemo(() => {
    if (scope.kind === "class") return scope.streams.filter((s) => s.is_active);
    const cls = classes.find((c) => c.id === otherId);
    return cls ? cls.streams.filter((s) => s.is_active) : [];
  }, [scope, classes, otherId]);

  function resetForm() {
    setTeacherId("");
    setOtherId("");
    setStreamId("");
    setIsClassTeacher(false);
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(a: (typeof assignments)[number]) {
    setAdding(false);
    setEditingId(a.id);
    setTeacherId(a.teacher_user_id);
    setOtherId(scope.kind === "subject" ? a.class_id : a.subject_id);
    setStreamId(a.stream_id ?? "");
    setIsClassTeacher(a.is_class_teacher);
  }

  async function saveEdit() {
    if (!editingId || !otherId) return;
    try {
      await updateAssignment({
        assignmentId: editingId,
        body: {
          class_id: scope.kind === "subject" ? otherId : scope.classId,
          subject_id: scope.kind === "subject" ? scope.subjectId : otherId,
          stream_id: streamId || undefined,
          clear_stream: !streamId,
          is_class_teacher: isClassTeacher,
        },
      }).unwrap();
      toast("Assignment updated.", "success");
      resetForm();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function submit() {
    if (!teacherId || !otherId) {
      toast("Pick a teacher and a " + (scope.kind === "subject" ? "class." : "subject."), "error");
      return;
    }
    try {
      await createAssignment({
        teacher_user_id: teacherId,
        class_id: scope.kind === "subject" ? otherId : scope.classId,
        subject_id: scope.kind === "subject" ? scope.subjectId : otherId,
        stream_id: streamId || undefined,
        is_class_teacher: isClassTeacher,
      }).unwrap();
      toast("Teacher assigned.", "success");
      resetForm();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Remove ${label}?`)) return;
    try {
      await deleteAssignment(id).unwrap();
      toast("Assignment removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Teachers
        </span>
        {isAdmin && !adding && !editingId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-700 hover:text-brand-800"
          >
            <Icon name="plus" size={12} /> Assign
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-[11px] text-slate-400">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="text-[11px] text-slate-400">No teacher assigned yet.</p>
      ) : (
        <ul className="space-y-1">
          {assignments.map((a) => {
            const placement = a.stream_name ? `${a.class_level} ${a.stream_name}` : a.class_level;
            const detail =
              scope.kind === "subject" ? placement : `${a.subject_code}`;
            return (
              <li
                key={a.id}
                className="group flex items-center gap-2 rounded-md bg-white px-2 py-1 text-[11px] ring-1 ring-slate-100"
              >
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  <span className="font-medium">{a.teacher_name}</span>
                  <span className="text-slate-400"> · {detail}</span>
                  {a.is_class_teacher && (
                    <span className="ml-1 rounded bg-gold-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-gold-800">
                      Class teacher
                    </span>
                  )}
                </span>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      disabled={deleting || updating}
                      aria-label="Edit assignment"
                      className="shrink-0 text-slate-300 opacity-0 transition hover:text-brand-700 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(a.id, `${a.teacher_name} · ${detail}`)}
                      disabled={deleting}
                      aria-label="Remove assignment"
                      className="shrink-0 text-slate-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(isAdmin && adding) || editingId ? (
        <div className="mt-2 space-y-2 border-t border-slate-200/70 pt-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={control}
              aria-label="Teacher"
              disabled={Boolean(editingId)}
            >
              <option value="">Teacher…</option>
              {staff.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {scope.kind === "subject" ? (
              <Select
                value={otherId}
                onChange={(e) => {
                  setOtherId(e.target.value);
                  setStreamId("");
                }}
                className={control}
                aria-label="Class"
              >
                <option value="">Class…</option>
                {eligibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label ? `${c.level} · ${c.label}` : c.level}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={otherId}
                onChange={(e) => setOtherId(e.target.value)}
                className={control}
                aria-label="Subject"
              >
                <option value="">Subject…</option>
                {eligibleSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={streamId}
              disabled={streamOptions.length === 0}
              onChange={(e) => setStreamId(e.target.value)}
              className={control}
              aria-label="Stream"
            >
              <option value="">All streams</option>
              {streamOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={isClassTeacher}
                onChange={(e) => setIsClassTeacher(e.target.checked)}
                className="rounded border-slate-300"
              />
              Class teacher
            </label>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={creating || updating}
              onClick={() => void (editingId ? saveEdit() : submit())}
            >
              {editingId ? "Save" : "Assign"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
