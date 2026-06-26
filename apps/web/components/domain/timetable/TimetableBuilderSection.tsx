"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { RefreshButton, refreshQueries } from "@/components/ui/RefreshButton";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { TimetableSlotOut } from "@/lib/types";
import {
  useCreateTimetableSlotMutation,
  useDeleteTimetableSlotMutation,
  useListClassesQuery,
  useListSubjectsQuery,
  useListTeacherStaffQuery,
  useListTimetableSlotsQuery,
  useUpdateTimetableSlotMutation,
} from "@/store/api/skulpulseApi";
import { TimetableCalendar } from "./TimetableCalendar";
import { TimetableImportPanel } from "./TimetableImportPanel";
import { TimetableLessonList } from "./TimetableLessonList";
import { TimetableMonthView } from "./TimetableMonthView";
import { TimetableViewToggle, type TimetableViewMode } from "./TimetableViewToggle";
import { DAY_NAMES, WEEK_DAYS, todayWeekday } from "./timetableUtils";

interface DraftSlot {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  class_id: string;
  stream_id: string;
  subject_id: string;
  teacher_user_id: string;
  room: string;
}

function emptyDraft(day: number, classId = "", streamId = ""): DraftSlot {
  return {
    day_of_week: day,
    starts_at: "08:00",
    ends_at: "08:40",
    class_id: classId,
    stream_id: streamId,
    subject_id: "",
    teacher_user_id: "",
    room: "",
  };
}

function toTimeInput(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function TimetableBuilderSection() {
  const { toast } = useToast();
  const { data: slots = [], isLoading, refetch: refetchSlots, isFetching: fetchingSlots } =
    useListTimetableSlotsQuery();
  const { data: classes = [], refetch: refetchClasses, isFetching: fetchingClasses } =
    useListClassesQuery();
  const { data: subjects = [], refetch: refetchSubjects, isFetching: fetchingSubjects } =
    useListSubjectsQuery();
  const { data: staff = [], refetch: refetchStaff, isFetching: fetchingStaff } =
    useListTeacherStaffQuery();
  const [createSlot, { isLoading: creating }] = useCreateTimetableSlotMutation();
  const [updateSlot, { isLoading: updating }] = useUpdateTimetableSlotMutation();
  const [deleteSlot] = useDeleteTimetableSlotMutation();

  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [viewMode, setViewMode] = useState<TimetableViewMode>("week");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSlot>(() => emptyDraft(todayWeekday()));

  // Default the filter to the first class once classes load.
  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const selectedClass = classes.find((c) => c.id === classId);
  const filteredSlots = useMemo(
    () =>
      slots.filter(
        (s) =>
          s.class_id === classId &&
          (!streamId || s.stream_id === streamId || s.stream_id == null),
      ),
    [slots, classId, streamId],
  );

  const draftClass = classes.find((c) => c.id === draft.class_id);

  function openAdd() {
    setImportOpen(false);
    setEditingSlotId(null);
    setDraft(emptyDraft(todayWeekday(), classId, streamId));
    setAddOpen(true);
  }

  function startEdit(slot: TimetableSlotOut) {
    setImportOpen(false);
    setEditingSlotId(slot.id);
    setDraft({
      day_of_week: slot.day_of_week,
      starts_at: toTimeInput(slot.starts_at),
      ends_at: toTimeInput(slot.ends_at),
      class_id: slot.class_id,
      stream_id: slot.stream_id ?? "",
      subject_id: slot.subject_id,
      teacher_user_id: slot.teacher_user_id,
      room: slot.room ?? "",
    });
    setAddOpen(true);
  }

  function closeForm() {
    setAddOpen(false);
    setEditingSlotId(null);
  }

  async function submit() {
    if (!draft.class_id || !draft.subject_id || !draft.teacher_user_id) {
      toast("Pick a class, subject, and teacher.", "error");
      return;
    }
    const body = {
      day_of_week: draft.day_of_week,
      starts_at: draft.starts_at,
      ends_at: draft.ends_at,
      class_id: draft.class_id,
      stream_id: draft.stream_id || undefined,
      subject_id: draft.subject_id,
      teacher_user_id: draft.teacher_user_id,
      room: draft.room.trim() || undefined,
    };
    try {
      if (editingSlotId) {
        await updateSlot({ slotId: editingSlotId, body }).unwrap();
        toast("Lesson updated.", "success");
      } else {
        await createSlot(body).unwrap();
        toast("Lesson added to the timetable.", "success");
      }
      setClassId(draft.class_id);
      closeForm();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove(id: string) {
    try {
      await deleteSlot(id).unwrap();
      toast("Lesson removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const isRefreshing = fetchingSlots || fetchingClasses || fetchingSubjects || fetchingStaff;

  async function refreshAll() {
    await refreshQueries(refetchSlots, refetchClasses, refetchSubjects, refetchStaff);
  }

  return (
    <div className="space-y-4 animate-fade-rise">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SettingsStatRow
          items={[
            { label: "Lessons", value: slots.length },
            { label: "This class", value: filteredSlots.length },
          ]}
        />
        <PageToolbar>
          <PageToolbarGroup>
            <TimetableViewToggle mode={viewMode} onChange={setViewMode} />
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId("");
              }}
              className="h-9 w-full text-[12px] sm:h-7 sm:w-auto"
              aria-label="Class"
            >
              {classes.length === 0 && <option value="">No classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ? `${c.level} · ${c.label}` : c.level}
                </option>
              ))}
            </Select>
            <Select
              value={streamId}
              disabled={!selectedClass || selectedClass.streams.length === 0}
              onChange={(e) => setStreamId(e.target.value)}
              className="h-9 w-full text-[12px] sm:h-7 sm:w-auto"
              aria-label="Stream"
            >
              <option value="">All streams</option>
              {selectedClass?.streams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </PageToolbarGroup>
          <PageToolbarGroup>
            <Button size="sm" variant="secondary" onClick={() => { setAddOpen(false); setImportOpen((v) => !v); }}>
              <Icon name="inbox" size={13} /> Import
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Icon name="plus" size={13} /> Add lesson
            </Button>
            <RefreshButton onRefresh={refreshAll} isRefreshing={isRefreshing} label="Refresh timetable" />
          </PageToolbarGroup>
        </PageToolbar>
      </div>

      {importOpen && <TimetableImportPanel onClose={() => setImportOpen(false)} />}

      {addOpen && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
              {editingSlotId ? "Edit lesson" : "New lesson"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Day">
              <Select
                value={draft.day_of_week}
                onChange={(e) => setDraft({ ...draft, day_of_week: Number(e.target.value) })}
              >
                {WEEK_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start">
              <Input
                type="time"
                value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </Field>
            <Field label="Class">
              <Select
                value={draft.class_id}
                onChange={(e) => setDraft({ ...draft, class_id: e.target.value, stream_id: "" })}
              >
                <option value="">Select…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label ? `${c.level} · ${c.label}` : c.level}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stream">
              <Select
                value={draft.stream_id}
                disabled={!draftClass || draftClass.streams.length === 0}
                onChange={(e) => setDraft({ ...draft, stream_id: e.target.value })}
              >
                <option value="">Whole class</option>
                {draftClass?.streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject">
              <Select
                value={draft.subject_id}
                onChange={(e) => setDraft({ ...draft, subject_id: e.target.value })}
              >
                <option value="">Select…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Teacher">
              <Select
                value={draft.teacher_user_id}
                onChange={(e) => setDraft({ ...draft, teacher_user_id: e.target.value })}
              >
                <option value="">Select…</option>
                {staff.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room (optional)">
              <Input
                value={draft.room}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                placeholder="e.g. Block A"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button size="sm" loading={creating || updating} onClick={() => void submit()}>
              {editingSlotId ? "Save changes" : "Add lesson"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-8 text-center text-[12px] text-slate-400">Loading timetable…</Card>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes yet"
          description="Set up classes under the Academic year settings before building a timetable."
        />
      ) : filteredSlots.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" size={18} />}
          title={`No lessons for ${selectedClass ? (selectedClass.label ? `${selectedClass.level} · ${selectedClass.label}` : selectedClass.level) : "this class"}`}
          description="Add lessons or import a filled template to build this class's weekly schedule."
        />
      ) : viewMode === "month" ? (
        <TimetableMonthView slots={filteredSlots} />
      ) : viewMode === "today" ? (
        <TimetableLessonList
          slots={filteredSlots}
          dayFilter={todayWeekday()}
          showTeacher
          showClass={false}
          highlightToday
          onEdit={startEdit}
          onDelete={(id) => void remove(id)}
          emptyMessage="No lessons scheduled for today in this class."
        />
      ) : (
        <>
          <div className="lg:hidden">
            <TimetableLessonList
              slots={filteredSlots}
              showTeacher
              showClass={false}
              highlightToday
              onEdit={startEdit}
              onDelete={(id) => void remove(id)}
            />
          </div>
          <div className="hidden lg:block">
            <TimetableCalendar
              slots={filteredSlots}
              onEdit={startEdit}
              onDelete={(id) => void remove(id)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
