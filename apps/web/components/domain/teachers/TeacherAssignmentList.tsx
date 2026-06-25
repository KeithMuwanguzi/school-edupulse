"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SettingsEmptyState } from "@/components/layout/settingsUi";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { TeacherAssignmentOut } from "@/lib/types";
import {
  useDeleteTeacherAssignmentMutation,
  useListClassesQuery,
  useListSubjectsQuery,
  useUpdateTeacherAssignmentMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";

function formatPlacement(row: TeacherAssignmentOut): string {
  const base = row.stream_name ? `${row.class_level} · ${row.stream_name}` : row.class_level;
  return row.is_class_teacher ? `${base} (class teacher)` : base;
}

interface TeacherAssignmentListProps {
  assignments: TeacherAssignmentOut[];
  isAdmin: boolean;
}

export function TeacherAssignmentList({ assignments, isAdmin }: TeacherAssignmentListProps) {
  const { toast } = useToast();
  const { data: classes = [] } = useListClassesQuery(undefined, { skip: !isAdmin });
  const { data: subjects = [] } = useListSubjectsQuery(undefined, { skip: !isAdmin });
  const [deleteAssignment, { isLoading: deleting }] = useDeleteTeacherAssignmentMutation();
  const [updateAssignment, { isLoading: saving }] = useUpdateTeacherAssignmentMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    class_id: "",
    subject_id: "",
    stream_id: "",
    is_class_teacher: false,
  });

  const streamOptions = useMemo(() => {
    const cls = classes.find((c) => c.id === draft.class_id);
    return cls ? cls.streams.filter((s) => s.is_active) : [];
  }, [classes, draft.class_id]);

  function startEdit(row: TeacherAssignmentOut) {
    setEditingId(row.id);
    setDraft({
      class_id: row.class_id,
      subject_id: row.subject_id,
      stream_id: row.stream_id ?? "",
      is_class_teacher: row.is_class_teacher,
    });
  }

  async function saveEdit(id: string) {
    if (!draft.class_id || !draft.subject_id) {
      toast("Pick a class and subject.", "error");
      return;
    }
    try {
      await updateAssignment({
        assignmentId: id,
        body: {
          class_id: draft.class_id,
          subject_id: draft.subject_id,
          stream_id: draft.stream_id || undefined,
          clear_stream: !draft.stream_id,
          is_class_teacher: draft.is_class_teacher,
        },
      }).unwrap();
      toast("Assignment updated.", "success");
      setEditingId(null);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Remove assignment for ${label}?`)) return;
    try {
      await deleteAssignment(id).unwrap();
      toast("Assignment removed.", "success");
      if (editingId === id) setEditingId(null);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (assignments.length === 0) {
    return <SettingsEmptyState message="No class or subject assignments yet." />;
  }

  return (
    <Table>
      <THead>
        <tr>
          <TH>Class</TH>
          <TH>Subject</TH>
          <TH className="hidden sm:table-cell">Term</TH>
          {isAdmin && <TH className="w-28" />}
        </tr>
      </THead>
      <TBody>
        {assignments.map((row) => (
          <TR key={row.id}>
            {editingId === row.id ? (
              <>
                <TD>
                  <div className="space-y-1">
                    <Select
                      value={draft.class_id}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, class_id: e.target.value, stream_id: "" }))
                      }
                      className="h-7 text-[12px]"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label ? `${c.level} · ${c.label}` : c.level}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={draft.stream_id}
                      disabled={streamOptions.length === 0}
                      onChange={(e) => setDraft((d) => ({ ...d, stream_id: e.target.value }))}
                      className="h-7 text-[12px]"
                    >
                      <option value="">All streams</option>
                      {streamOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </TD>
                <TD>
                  <Select
                    value={draft.subject_id}
                    onChange={(e) => setDraft((d) => ({ ...d, subject_id: e.target.value }))}
                    className="h-7 text-[12px]"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD className="hidden sm:table-cell">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={draft.is_class_teacher}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, is_class_teacher: e.target.checked }))
                      }
                      className="rounded border-slate-300"
                    />
                    Class teacher
                  </label>
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" loading={saving} onClick={() => void saveEdit(row.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </TD>
              </>
            ) : (
              <>
                <TD>{formatPlacement(row)}</TD>
                <TD>
                  <span className="font-medium text-slate-700">{row.subject_name}</span>
                  <span className="ml-1 font-mono text-[10px] text-slate-400">{row.subject_code}</span>
                </TD>
                <TD className="hidden text-slate-400 sm:table-cell">
                  {row.term_label ?? "Whole year"}
                </TD>
                {isAdmin && (
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-[11px] text-slate-400 hover:text-brand-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row.id, row.subject_code)}
                        disabled={deleting}
                        className="text-[11px] text-slate-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </TD>
                )}
              </>
            )}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
