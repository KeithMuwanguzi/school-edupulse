"use client";

import { useEffect, useMemo, useState } from "react";
import { MarksImportSection } from "@/components/domain/assessment/MarksImportSection";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { SettingsHint } from "@/components/layout/settingsUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import type { AssessmentSetOut, MarkEntryStudentRow } from "@/lib/types";
import {
  useAssessmentCaConfigQuery,
  useAssessmentSetsQuery,
  useAssessmentSummaryQuery,
  useAssessmentMarksGridQuery,
  useCloseAssessmentSetMutation,
  useComputedCaQuery,
  useCreateAssessmentSetMutation,
  useDeleteAssessmentSetMutation,
  useListClassesQuery,
  useListTeacherAssignmentsQuery,
  useMarkEntryRosterQuery,
  useOpenAssessmentSetMutation,
  useSaveAssessmentMarksMutation,
  useUpdateAssessmentCaConfigMutation,
  useUpdateAssessmentSetMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";

const compactControl = "h-7 text-[12px]";
const COMPETENCE_OPTIONS = [
  { value: "emerging", label: "Emerging" },
  { value: "developing", label: "Developing" },
  { value: "proficient", label: "Proficient" },
  { value: "excellent", label: "Excellent" },
];

const STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = {
  open: "green",
  closed: "neutral",
  draft: "amber",
};

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AssessmentSetRow({ set }: { set: AssessmentSetOut }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [openSet] = useOpenAssessmentSetMutation();
  const [closeSet] = useCloseAssessmentSetMutation();
  const [updateSet, { isLoading: saving }] = useUpdateAssessmentSetMutation();
  const [deleteSet] = useDeleteAssessmentSetMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(set.name);

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      toast(ok, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function rename() {
    if (!name.trim()) {
      toast("Name is required.", "error");
      return;
    }
    await run(async () => {
      await updateSet({ setId: set.id, body: { name: name.trim() } }).unwrap();
      setEditing(false);
    }, "Set renamed.");
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete assessment set",
      description: `Delete the "${set.name}" set? All marks in this set will be removed.`,
      confirmLabel: "Delete set",
      tone: "danger",
    });
    if (!ok) return;
    await run(() => deleteSet(set.id).unwrap(), "Set deleted.");
  }

  if (editing) {
    return (
      <TR>
        <TD>
          <Input value={name} onChange={(e) => setName(e.target.value)} className={compactControl} />
        </TD>
        <TD>
          <Badge tone={STATUS_TONE[set.entry_status] ?? "neutral"}>{set.entry_status}</Badge>
        </TD>
        <TD>{set.marks_entered}</TD>
        <TD className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" loading={saving} onClick={() => void rename()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setName(set.name); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </TD>
      </TR>
    );
  }

  return (
    <TR>
      <TD>{set.name}</TD>
      <TD>
        <Badge tone={STATUS_TONE[set.entry_status] ?? "neutral"}>{set.entry_status}</Badge>
      </TD>
      <TD>{set.marks_entered}</TD>
      <TD className="text-right">
        <div className="flex justify-end gap-1">
          {set.entry_status === "open" ? (
            <Button size="sm" variant="ghost" onClick={() => void run(() => closeSet(set.id).unwrap(), "Set closed.")}>
              Close
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => void run(() => openSet(set.id).unwrap(), "Set opened for entry.")}>
              Open entry
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </TD>
    </TR>
  );
}

function AssessmentSetMobileCard({ set }: { set: AssessmentSetOut }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [openSet] = useOpenAssessmentSetMutation();
  const [closeSet] = useCloseAssessmentSetMutation();
  const [updateSet, { isLoading: saving }] = useUpdateAssessmentSetMutation();
  const [deleteSet] = useDeleteAssessmentSetMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(set.name);

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      toast(ok, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function rename() {
    if (!name.trim()) {
      toast("Name is required.", "error");
      return;
    }
    await run(async () => {
      await updateSet({ setId: set.id, body: { name: name.trim() } }).unwrap();
      setEditing(false);
    }, "Set renamed.");
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete assessment set",
      description: `Delete the "${set.name}" set? All marks in this set will be removed.`,
      confirmLabel: "Delete set",
      tone: "danger",
    });
    if (!ok) return;
    await run(() => deleteSet(set.id).unwrap(), "Set deleted.");
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      {editing ? (
        <div className="space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className={compactControl} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="secondary" loading={saving} className="w-full sm:w-auto" onClick={() => void rename()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => { setName(set.name); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-slate-900">{set.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{set.marks_entered} marks entered</p>
            </div>
            <Badge tone={STATUS_TONE[set.entry_status] ?? "neutral"}>{set.entry_status}</Badge>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            {set.entry_status === "open" ? (
              <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => void run(() => closeSet(set.id).unwrap(), "Set closed.")}>
                Close
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => void run(() => openSet(set.id).unwrap(), "Set opened for entry.")}>
                Open entry
              </Button>
            )}
            <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminSetsPanel({ termId }: { termId: string }) {
  const { toast } = useToast();
  const { data: sets = [], isLoading } = useAssessmentSetsQuery({ termId });
  const { data: caConfig } = useAssessmentCaConfigQuery({ termId });
  const [createSet, { isLoading: creating }] = useCreateAssessmentSetMutation();
  const [updateCa, { isLoading: savingCa }] = useUpdateAssessmentCaConfigMutation();
  const [name, setName] = useState("");
  const [maxMark, setMaxMark] = useState("100");
  const [method, setMethod] = useState<"average" | "weighted_average">("average");
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (caConfig?.inclusions.length) {
      setSelectedSets(new Set(caConfig.inclusions.map((i) => i.set_id)));
      setMethod(caConfig.method as "average" | "weighted_average");
    }
  }, [caConfig]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createSet({
        term_id: termId,
        name: name.trim(),
        max_mark: Number(maxMark) || 100,
      }).unwrap();
      setName("");
      toast("Assessment set created.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function saveCaConfig() {
    try {
      await updateCa({
        termId,
        body: {
          method,
          inclusions: sets
            .filter((s) => selectedSets.has(s.id))
            .map((s, idx) => ({ set_id: s.id, weight: 1, sort_order: idx })),
        },
      }).unwrap();
      toast("CA configuration saved.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Term assessment sets" description="Create sets and open them when teachers should enter marks." />
        <CardBody className="space-y-3 py-3">
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <FormField label="Set name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CAT 1" className={compactControl} />
              </FormField>
            </div>
            <FormField label="Max mark">
              <Input type="number" value={maxMark} onChange={(e) => setMaxMark(e.target.value)} className={`${compactControl} w-full sm:w-20`} />
            </FormField>
            <Button size="sm" variant="secondary" loading={creating} type="submit" className="w-full sm:w-auto">
              Add set
            </Button>
          </form>
          <div className="space-y-2 md:hidden">
            {sets.map((set) => (
              <AssessmentSetMobileCard key={set.id} set={set} />
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <THead>
              <TR>
                <TH>Set</TH>
                <TH>Status</TH>
                <TH>Marks</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {sets.map((set) => (
                <AssessmentSetRow key={set.id} set={set} />
              ))}
            </TBody>
          </Table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Continuous assessment"
          description="Choose which sets count toward term CA per subject (usually the average)."
        />
        <CardBody className="space-y-3 py-3">
          <FormField label="Calculation method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={compactControl}>
              <option value="average">Simple average</option>
              <option value="weighted_average">Weighted average</option>
            </Select>
          </FormField>
          <SettingsHint>Tick the sets to include. Marks are normalised to percentages before averaging.</SettingsHint>
          <ul className="space-y-1">
            {sets.map((set) => (
              <li key={set.id} className="flex items-center gap-2 text-[12px] text-slate-600">
                <input
                  type="checkbox"
                  checked={selectedSets.has(set.id)}
                  onChange={(e) => {
                    setSelectedSets((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(set.id);
                      else next.delete(set.id);
                      return next;
                    });
                  }}
                />
                {set.name}
                <span className="text-slate-400">({set.entry_status})</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" loading={savingCa} onClick={() => void saveCaConfig()}>
            Save CA config
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function formatCaCell(sub: {
  ca_score?: number | null;
  grade_label?: string | null;
  competence_level?: string | null;
}) {
  if (sub.ca_score != null) {
    return sub.grade_label ? `${sub.ca_score} (${sub.grade_label})` : String(sub.ca_score);
  }
  if (sub.competence_level) return sub.competence_level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "—";
}

function AdminCaOverview({ termId }: { termId: string }) {
  const { data: classes = [] } = useListClassesQuery();
  const { data: sets = [] } = useAssessmentSetsQuery({ termId });
  const [classId, setClassId] = useState("");
  const [setId, setSetId] = useState("");
  const [view, setView] = useState<"ca" | "marks">("marks");

  const { data: computed, isFetching: loadingCa } = useComputedCaQuery(
    { classId, termId },
    { skip: !classId || view !== "ca" },
  );
  const { data: marksGrid, isFetching: loadingMarks } = useAssessmentMarksGridQuery(
    { setId, classId, termId },
    { skip: !classId || !setId || view !== "marks" },
  );

  const hasCaData =
    computed &&
    computed.students.some((s) =>
      s.subjects.some((sub) => sub.ca_score != null || sub.competence_level),
    );
  const hasMarksData =
    marksGrid &&
    marksGrid.students.some((s) => s.cells.some((c) => c.display !== "—"));

  return (
    <Card>
      <CardHeader
        title="Assessment overview"
        description="View recorded marks by set or computed continuous assessment by class."
      />
      <CardBody className="space-y-3 py-3">
        <PageToolbar className="sm:justify-start">
          <PageToolbarGroup className="w-full sm:flex-1">
            <FormField label="Class">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${compactControl} w-full`}>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label ?? c.level}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="View">
              <Select value={view} onChange={(e) => setView(e.target.value as typeof view)} className={`${compactControl} w-full`}>
                <option value="marks">Recorded marks</option>
                <option value="ca">Computed CA</option>
              </Select>
            </FormField>
            {view === "marks" && (
              <FormField label="Assessment set">
                <Select value={setId} onChange={(e) => setSetId(e.target.value)} className={`${compactControl} w-full`}>
                  <option value="">Select set</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.entry_status})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </PageToolbarGroup>
        </PageToolbar>

        {!classId && (
          <EmptyState title="Select a class" description="Choose a class to load assessment data." />
        )}

        {view === "marks" && classId && !setId && (
          <EmptyState title="Select an assessment set" description="Pick the set where marks were entered." />
        )}

        {view === "ca" && computed && !computed.ca_configured && (
          <SettingsHint>
            CA is not configured yet — showing an average of all recorded sets. Save CA config above to control which sets count.
          </SettingsHint>
        )}

        {view === "ca" && computed?.using_all_recorded_sets && (
          <SettingsHint>Using all recorded assessment sets until CA configuration is saved.</SettingsHint>
        )}

        {(loadingCa || loadingMarks) && <PageLoader />}

        {view === "marks" && marksGrid && (
          <>
            {marksGrid.students.length === 0 ? (
              <EmptyState title="No learners in class" description="Enroll learners in this class first." />
            ) : !hasMarksData ? (
              <EmptyState
                title="No marks recorded"
                description={`No marks found for ${marksGrid.set_name} in this class yet.`}
              />
            ) : (
              <>
                <p className="text-[12px] text-slate-500 md:hidden">
                  {marksGrid.set_name} · {marksGrid.scoring_mode === "competency" ? "Competence levels" : `Scores / ${marksGrid.max_mark}`}
                </p>
                <div className="space-y-2 md:hidden">
                  {marksGrid.students.map((student) => (
                    <div key={student.student_id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[13px] font-medium text-slate-900">{formatStudentFullName(student)}</p>
                      <dl className="mt-2 space-y-1">
                        {student.cells.map((cell) => (
                          <div key={cell.subject_id} className="flex justify-between text-[11px]">
                            <dt className="text-slate-500">{marksGrid.subjects.find((s) => s.subject_id === cell.subject_id)?.subject_code}</dt>
                            <dd className="font-medium text-slate-800">{cell.display}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <p className="mb-2 text-[12px] text-slate-500">
                  {marksGrid.set_name} · {marksGrid.scoring_mode === "competency" ? "Competence levels" : `Scores / ${marksGrid.max_mark}`}
                </p>
                <Table>
                  <THead>
                    <TR>
                      <TH>Learner</TH>
                      {marksGrid.subjects.map((s) => (
                        <TH key={s.subject_id}>{s.subject_code}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {marksGrid.students.map((student) => (
                      <TR key={student.student_id}>
                        <TD>{formatStudentFullName(student)}</TD>
                        {student.cells.map((cell) => (
                          <TD key={cell.subject_id}>{cell.display}</TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
                </div>
              </>
            )}
          </>
        )}

        {view === "ca" && computed && (
          <>
            {computed.students.length === 0 ? (
              <EmptyState
                title="No registered learners"
                description="Complete term check-in for learners in this class to include them in CA."
              />
            ) : !hasCaData ? (
              <EmptyState
                title="No CA scores yet"
                description="Enter marks in an open assessment set, or configure CA inclusions above."
              />
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {computed.students.map((student) => (
                    <div key={student.student_id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium text-slate-900">{formatStudentFullName(student)}</p>
                        <div className="text-right text-[11px] text-slate-500">
                          <p>Avg {student.average_score ?? "—"}</p>
                          <p>Div {student.division_label ?? "—"}</p>
                        </div>
                      </div>
                      <dl className="mt-2 space-y-1">
                        {student.subjects.map((sub) => (
                          <div key={sub.subject_id} className="flex justify-between text-[11px]">
                            <dt className="text-slate-500">{sub.subject_code}{sub.is_core ? " *" : ""}</dt>
                            <dd className="font-medium text-slate-800">{formatCaCell(sub)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <p className="mb-2 text-[12px] text-slate-500">
                  Continuous assessment per subject (score and grade), with term aggregate and division.
                </p>
                <Table>
                  <THead>
                    <TR>
                      <TH>Learner</TH>
                      {computed.students[0]?.subjects.map((s) => (
                        <TH key={s.subject_id}>
                          {s.subject_code}
                          {s.is_core ? " *" : ""}
                        </TH>
                      ))}
                      <TH>Avg</TH>
                      <TH>Aggregate</TH>
                      <TH>Division</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {computed.students.map((student) => (
                      <TR key={student.student_id}>
                        <TD>{formatStudentFullName(student)}</TD>
                        {student.subjects.map((sub) => (
                          <TD key={sub.subject_id}>{formatCaCell(sub)}</TD>
                        ))}
                        <TD>{student.average_score ?? "—"}</TD>
                        <TD>{student.aggregate ?? "—"}</TD>
                        <TD>{student.division_label ?? "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <p className="mt-2 text-[11px] text-slate-400">* core subjects counted toward the aggregate.</p>
                </div>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function TeacherMarkEntry({ termId }: { termId: string }) {
  const { toast } = useToast();
  const user = useAppSelector((s) => s.auth.user);
  const { data: assignments = [] } = useListTeacherAssignmentsQuery(
    user ? { teacherUserId: user.id } : undefined,
    { skip: !user },
  );
  const { data: sets = [] } = useAssessmentSetsQuery({ termId });
  const openSets = sets.filter((s) => s.entry_status === "open");

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      if (a.class_id) map.set(a.class_id, a.class_level);
    }
    return [...map.entries()];
  }, [assignments]);

  const [setId, setSetId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Record<string, MarkEntryStudentRow>>({});
  const [showImport, setShowImport] = useState(false);

  const subjectOptions = assignments
    .filter((a) => a.class_id === classId)
    .map((a) => ({ id: a.subject_id, name: a.subject_name ?? a.subject_code ?? "Subject" }));
  const subjectName =
    subjectOptions.find((s) => s.id === subjectId)?.name ?? "subject";

  const { data: roster, isFetching, refetch } = useMarkEntryRosterQuery(
    { setId, classId, subjectId },
    { skip: !setId || !classId || !subjectId },
  );

  useEffect(() => {
    if (roster) {
      const next: Record<string, MarkEntryStudentRow> = {};
      for (const row of roster.students) next[row.student_id] = { ...row };
      setDraft(next);
    }
  }, [roster]);

  const [saveMarks, { isLoading: saving }] = useSaveAssessmentMarksMutation();

  async function handleSave() {
    if (!roster?.can_edit) return;
    try {
      const marks = Object.values(draft).map((row) => ({
        student_id: row.student_id,
        score: row.score ?? null,
        competence_level: row.competence_level ?? null,
        remark: row.remark ?? null,
      }));
      const res = await saveMarks({
        set_id: setId,
        class_id: classId,
        subject_id: subjectId,
        marks,
      }).unwrap();
      toast(`${res.saved} mark(s) saved.`, "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <Card>
      <CardHeader title="Enter marks" description="Open sets only — for classes and subjects you are assigned to." />
      <CardBody className="space-y-3 py-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <FormField label="Assessment set">
            <Select value={setId} onChange={(e) => setSetId(e.target.value)} className={compactControl}>
              <option value="">Select set</option>
              {openSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Class">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} className={compactControl}>
              <option value="">Select class</option>
              {classOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subject">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={compactControl}>
              <option value="">Select subject</option>
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {isFetching && <PageLoader />}
        {roster && (
          <>
            {!roster.can_edit && (
              <SettingsHint>This set is read-only — it may be closed or you lack assignment.</SettingsHint>
            )}
            {roster.can_edit && (
              <PageToolbar className="sm:justify-between">
                <p className="text-[12px] text-slate-500">
                  {roster.students.length} onboarded pupil(s) in this class.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => setShowImport((v) => !v)}
                >
                  {showImport ? "Hide import" : "Import from Excel/CSV"}
                </Button>
              </PageToolbar>
            )}
            {roster.can_edit && showImport && (
              <MarksImportSection
                setId={setId}
                classId={classId}
                subjectId={subjectId}
                subjectName={subjectName}
                maxMark={roster.max_mark}
                onClose={() => setShowImport(false)}
                onImported={() => {
                  setShowImport(false);
                  void refetch();
                }}
              />
            )}
            <div className="space-y-2 md:hidden">
              {Object.values(draft).map((row) => (
                <div key={row.student_id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-[13px] font-medium text-slate-900">{formatStudentFullName(row)}</p>
                  {roster.scoring_mode === "competency" ? (
                    <Select
                      value={row.competence_level ?? ""}
                      disabled={!roster.can_edit}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.student_id]: { ...row, competence_level: e.target.value || null },
                        }))
                      }
                      className={`${compactControl} w-full`}
                    >
                      <option value="">—</option>
                      {COMPETENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={roster.max_mark}
                      disabled={!roster.can_edit}
                      value={row.score ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.student_id]: {
                            ...row,
                            score: e.target.value === "" ? null : Number(e.target.value),
                          },
                        }))
                      }
                      className={`${compactControl} w-full`}
                      placeholder={`Score / ${roster.max_mark}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Learner</TH>
                  <TH>{roster.scoring_mode === "competency" ? "Competence" : `Score / ${roster.max_mark}`}</TH>
                </TR>
              </THead>
              <TBody>
                {Object.values(draft).map((row) => (
                  <TR key={row.student_id}>
                    <TD>{formatStudentFullName(row)}</TD>
                    <TD>
                      {roster.scoring_mode === "competency" ? (
                        <Select
                          value={row.competence_level ?? ""}
                          disabled={!roster.can_edit}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [row.student_id]: { ...row, competence_level: e.target.value || null },
                            }))
                          }
                          className={compactControl}
                        >
                          <option value="">—</option>
                          {COMPETENCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={roster.max_mark}
                          disabled={!roster.can_edit}
                          value={row.score ?? ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [row.student_id]: {
                                ...row,
                                score: e.target.value === "" ? null : Number(e.target.value),
                              },
                            }))
                          }
                          className={`${compactControl} w-24`}
                        />
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            </div>
            {roster.can_edit && (
              <Button size="sm" variant="secondary" loading={saving} className="w-full sm:w-auto" onClick={() => void handleSave()}>
                Save marks
              </Button>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function AssessmentModuleView() {
  const user = useAppSelector((s) => s.auth.user);
  const { data: summary, isLoading, isError } = useAssessmentSummaryQuery();
  const isAdmin = user?.role === "school_admin" || user?.role === "deputy_head";
  const isTeacher = user?.role === "teacher";

  if (!user) return <PageLoader />;
  if (!user.modules.includes("assessment")) {
    return (
      <EmptyState
        title="Assessment module not enabled"
        description="Contact SkulPulse to add Assessment to your subscription."
      />
    );
  }
  if (isLoading) return <PageLoader />;
  if (isError || !summary)
    return (
      <ErrorBanner message="Couldn't load assessment data. Please refresh and try again." />
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Term sets" value={String(summary.total_sets)} />
        <SummaryStat label="Open for entry" value={String(summary.open_sets)} />
        <SummaryStat label="Marks recorded" value={String(summary.total_marks)} />
        <SummaryStat label="CA configured" value={summary.ca_configured ? "Yes" : "No"} />
      </div>

      {isTeacher && <TeacherMarkEntry termId={summary.term_id} />}
      {isAdmin && (
        <>
          <AdminSetsPanel termId={summary.term_id} />
          <AdminCaOverview termId={summary.term_id} />
        </>
      )}
      {!isAdmin && !isTeacher && (
        <EmptyState title="No assessment actions" description="Assessment entry is for teachers; configuration is for admins." />
      )}
    </div>
  );
}
