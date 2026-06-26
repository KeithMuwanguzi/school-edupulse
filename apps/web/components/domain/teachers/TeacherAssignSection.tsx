"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { SettingsHint } from "@/components/layout/settingsUi";
import { parseError } from "@/lib/apiError";
import {
  useCreateTeacherAssignmentMutation,
  useListClassesQuery,
  useListSubjectsQuery,
  useListTeacherStaffQuery,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

import { ALL_CLASS_LEVELS, LEVEL_CYCLE } from "@/lib/schoolLevels";

const compactControl = "h-7 text-[12px]";

const LEVEL_CYCLES: Record<string, string[]> = Object.fromEntries(
  ALL_CLASS_LEVELS.map((level) => [level, [LEVEL_CYCLE[level]]]),
);

interface TeacherAssignSectionProps {
  onBack: () => void;
}

export function TeacherAssignSection({ onBack }: TeacherAssignSectionProps) {
  const { toast } = useToast();
  const { data: staff = [] } = useListTeacherStaffQuery();
  const { data: classes = [] } = useListClassesQuery();
  const { data: subjects = [] } = useListSubjectsQuery();
  const [createAssignment, { isLoading }] = useCreateTeacherAssignmentMutation();

  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  const eligibleSubjects = useMemo(() => {
    if (!selectedClass) return subjects.filter((s) => s.is_active);
    const cycles = LEVEL_CYCLES[selectedClass.level] ?? [];
    return subjects.filter(
      (s) => s.is_active && s.ncdc_cycles.some((c) => cycles.includes(c)),
    );
  }, [subjects, selectedClass]);

  useEffect(() => {
    if (!classId) {
      setStreamId("");
      setSubjectId("");
    } else {
      if (streamId && !streams.some((s) => s.id === streamId)) setStreamId("");
      if (subjectId && !eligibleSubjects.some((s) => s.id === subjectId)) setSubjectId("");
    }
  }, [classId, streamId, subjectId, streams, eligibleSubjects]);

  const canSubmit = teacherId && classId && subjectId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createAssignment({
        teacher_user_id: teacherId,
        class_id: classId,
        subject_id: subjectId,
        stream_id: streamId || undefined,
        is_class_teacher: isClassTeacher,
      }).unwrap();
      toast("Assignment saved.", "success");
      onBack();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Add assignment"
        description="Link a teacher to a class and subject for the active year."
        action={
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            Back
          </button>
        }
      />
      <CardBody className="space-y-3 py-3">
        {staff.length === 0 ? (
          <SettingsHint>Add teaching staff under Settings → Users before assigning classes.</SettingsHint>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Teacher" required>
                <Select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className={compactControl}
                  required
                >
                  <option value="">Select teacher…</option>
                  {staff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Class" required>
                <Select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={compactControl}
                  required
                >
                  <option value="">Select class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.level}
                    </option>
                  ))}
                </Select>
              </FormField>
              {streams.length > 0 && (
                <FormField label="Stream">
                  <Select
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                    className={compactControl}
                  >
                    <option value="">All streams</option>
                    {streams.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField label="Subject" required>
                <Select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={compactControl}
                  required
                  disabled={!classId}
                >
                  <option value="">Select subject…</option>
                  {eligibleSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={isClassTeacher}
                onChange={(e) => setIsClassTeacher(e.target.checked)}
                className="rounded border-slate-300"
              />
              Class teacher for this class
            </label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={onBack}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="secondary" loading={isLoading} disabled={!canSubmit}>
                Save assignment
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
