"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { ALL_CLASS_LEVELS, levelLabel } from "@/lib/schoolLevels";
import type { FeeStructureOut } from "@/lib/types";
import {
  useAcademicContextQuery,
  useActivateFeeStructureMutation,
  useAddFeeStructureLineMutation,
  useCreateFeeStructureMutation,
  useDeleteFeeStructureLineMutation,
  useFeeStructuresQuery,
  useUpdateFeeStructureLineMutation,
  useUpdateFeeStructureMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import type { FeeStructureLineOut } from "@/lib/types";

const APPLIES_TO_OPTIONS = [
  { value: "all", label: "All students" },
  { value: "class_level", label: "Class level" },
  { value: "day", label: "Day students" },
  { value: "boarder", label: "Boarders" },
];

function appliesToLabel(line: FeeStructureLineOut) {
  if (line.applies_to === "all") return "All students";
  if (line.applies_to === "class_level") return `Level ${line.class_level}`;
  if (line.applies_to === "day") return "Day students";
  if (line.applies_to === "boarder") return "Boarders";
  return line.applies_to;
}

function structureSummary(structure: FeeStructureOut) {
  const catalog = formatUGX(structure.catalog_total_ugx ?? structure.total_ugx);
  const expected = formatUGX(structure.expected_invoiced_ugx ?? 0);
  return `${structure.term_label} · ${structure.line_count} line(s) · Catalog ${catalog} · Expected ${expected}`;
}

function ApplicabilityFields({
  appliesTo,
  classLevel,
  onAppliesToChange,
  onClassLevelChange,
}: {
  appliesTo: string;
  classLevel: string;
  onAppliesToChange: (value: string) => void;
  onClassLevelChange: (value: string) => void;
}) {
  return (
    <>
      <FormField label="Applies to">
        <Select value={appliesTo} onChange={(e) => onAppliesToChange(e.target.value)} className="text-[12px]">
          {APPLIES_TO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
      {appliesTo === "class_level" && (
        <FormField label="Class level">
          <Select value={classLevel} onChange={(e) => onClassLevelChange(e.target.value)} className="text-[12px]">
            {ALL_CLASS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level} · {levelLabel(level)}
              </option>
            ))}
          </Select>
        </FormField>
      )}
    </>
  );
}

function LineMobileCard({
  structureId,
  line,
  editable,
}: {
  structureId: string;
  line: FeeStructureLineOut;
  editable: boolean;
}) {
  const { toast } = useToast();
  const [updateLine, { isLoading: saving }] = useUpdateFeeStructureLineMutation();
  const [deleteLine] = useDeleteFeeStructureLineMutation();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(line.label);
  const [amount, setAmount] = useState(String(line.amount_ugx));
  const [appliesTo, setAppliesTo] = useState(line.applies_to);
  const [classLevel, setClassLevel] = useState(line.class_level ?? "P1");

  function cancel() {
    setLabel(line.label);
    setAmount(String(line.amount_ugx));
    setAppliesTo(line.applies_to);
    setClassLevel(line.class_level ?? "P1");
    setEditing(false);
  }

  async function save() {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!label.trim() || Number.isNaN(parsed) || parsed < 0) {
      toast("Enter a label and valid amount.", "error");
      return;
    }
    if (appliesTo === "class_level" && !classLevel) {
      toast("Select a class level.", "error");
      return;
    }
    try {
      await updateLine({
        structureId,
        lineId: line.id,
        body: {
          label: label.trim(),
          amount_ugx: parsed,
          applies_to: appliesTo,
          class_level: appliesTo === "class_level" ? classLevel : null,
        },
      }).unwrap();
      toast("Fee line updated.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    try {
      await deleteLine({ structureId, lineId: line.id }).unwrap();
      toast("Line removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-3 space-y-2">
        <FormField label="Fee item">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="text-[12px]" />
        </FormField>
        <FormField label="Amount (UGX)">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-[12px]" />
        </FormField>
        <ApplicabilityFields
          appliesTo={appliesTo}
          classLevel={classLevel}
          onAppliesToChange={setAppliesTo}
          onClassLevelChange={setClassLevel}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={saving} className="flex-1" onClick={() => void save()}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{line.label}</p>
          <p className="text-[11px] text-slate-500">{appliesToLabel(line)}</p>
        </div>
        <p className="shrink-0 font-semibold text-slate-800">{formatUGX(line.amount_ugx)}</p>
      </div>
      {editable && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

function LineRow({
  structureId,
  line,
  editable,
}: {
  structureId: string;
  line: FeeStructureLineOut;
  editable: boolean;
}) {
  const { toast } = useToast();
  const [updateLine, { isLoading: saving }] = useUpdateFeeStructureLineMutation();
  const [deleteLine] = useDeleteFeeStructureLineMutation();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(line.label);
  const [amount, setAmount] = useState(String(line.amount_ugx));
  const [appliesTo, setAppliesTo] = useState(line.applies_to);
  const [classLevel, setClassLevel] = useState(line.class_level ?? "P1");

  function cancel() {
    setLabel(line.label);
    setAmount(String(line.amount_ugx));
    setAppliesTo(line.applies_to);
    setClassLevel(line.class_level ?? "P1");
    setEditing(false);
  }

  async function save() {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!label.trim() || Number.isNaN(parsed) || parsed < 0) {
      toast("Enter a label and valid amount.", "error");
      return;
    }
    if (appliesTo === "class_level" && !classLevel) {
      toast("Select a class level.", "error");
      return;
    }
    try {
      await updateLine({
        structureId,
        lineId: line.id,
        body: {
          label: label.trim(),
          amount_ugx: parsed,
          applies_to: appliesTo,
          class_level: appliesTo === "class_level" ? classLevel : null,
        },
      }).unwrap();
      toast("Fee line updated.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    try {
      await deleteLine({ structureId, lineId: line.id }).unwrap();
      toast("Line removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (editing) {
    return (
      <TR>
        <TD>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 text-[12px]" />
        </TD>
        <TD>
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-7 w-28 text-[12px]"
          />
        </TD>
        <TD>
          <div className="space-y-1">
            <Select
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value)}
              className="h-7 text-[12px]"
            >
              {APPLIES_TO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {appliesTo === "class_level" && (
              <Select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className="h-7 text-[12px]"
              >
                {ALL_CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </TD>
        <TD>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </TD>
      </TR>
    );
  }

  return (
    <TR>
      <TD>{line.label}</TD>
      <TD>{formatUGX(line.amount_ugx)}</TD>
      <TD className="text-[12px] text-slate-600">{appliesToLabel(line)}</TD>
      {editable && (
        <TD>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove()}>
              Remove
            </Button>
          </div>
        </TD>
      )}
    </TR>
  );
}

function StructureEditor({
  structure,
  readOnly,
}: {
  structure: FeeStructureOut;
  readOnly: boolean;
}) {
  const { toast } = useToast();
  const [addLine, { isLoading: adding }] = useAddFeeStructureLineMutation();
  const [activate, { isLoading: activating }] = useActivateFeeStructureMutation();
  const [updateStructure, { isLoading: savingMeta }] = useUpdateFeeStructureMutation();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [classLevel, setClassLevel] = useState("P5");
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState(structure.name);
  const [metaDue, setMetaDue] = useState(structure.due_on ?? "");
  const [metaNotes, setMetaNotes] = useState(structure.notes ?? "");

  const isDraft = structure.status === "draft";
  const canEdit = isDraft && !readOnly;

  function cancelMeta() {
    setMetaName(structure.name);
    setMetaDue(structure.due_on ?? "");
    setMetaNotes(structure.notes ?? "");
    setEditingMeta(false);
  }

  async function saveMeta() {
    if (!metaName.trim()) {
      toast("Name is required.", "error");
      return;
    }
    try {
      await updateStructure({
        structureId: structure.id,
        body: {
          name: metaName.trim(),
          due_on: metaDue || null,
          notes: metaNotes.trim() || null,
        },
      }).unwrap();
      toast("Structure updated.", "success");
      setEditingMeta(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(/,/g, ""));
    if (!label.trim() || !parsed || parsed < 0) {
      toast("Enter a label and valid amount.", "error");
      return;
    }
    try {
      await addLine({
        structureId: structure.id,
        body: {
          label: label.trim(),
          amount_ugx: parsed,
          applies_to: appliesTo,
          class_level: appliesTo === "class_level" ? classLevel : undefined,
        },
      }).unwrap();
      setLabel("");
      setAmount("");
      toast("Fee line added.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleActivate() {
    try {
      await activate(structure.id).unwrap();
      toast("Fee structure activated.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title={structure.name}
        description={structureSummary(structure)}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Badge tone={structure.status === "active" ? "green" : "neutral"} dot>
              {structure.status}
            </Badge>
            {canEdit && !editingMeta && (
              <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setEditingMeta(true)}>
                Edit details
              </Button>
            )}
            {isDraft && !readOnly && (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={handleActivate}
                disabled={activating || structure.line_count === 0}
              >
                {activating ? "Activating…" : "Activate"}
              </Button>
            )}
          </div>
        }
      />
      <CardBody className="space-y-4">
        {Object.keys(structure.level_amounts_ugx ?? {}).length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Per-student base by level
            </p>
            <p className="mb-2 text-[11px] text-slate-500">
              Includes all-student and class-level lines only. Day/boarder charges vary by learner.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(structure.level_amounts_ugx).map(([level, amount]) => (
                <span
                  key={level}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700"
                >
                  {level}: {formatUGX(amount)}
                </span>
              ))}
            </div>
          </div>
        )}
        {editingMeta && (
          <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-2">
            <FormField label="Name" htmlFor={`meta-name-${structure.id}`} required>
              <Input
                id={`meta-name-${structure.id}`}
                value={metaName}
                onChange={(e) => setMetaName(e.target.value)}
              />
            </FormField>
            <FormField label="Due date" htmlFor={`meta-due-${structure.id}`}>
              <Input
                id={`meta-due-${structure.id}`}
                type="date"
                value={metaDue}
                onChange={(e) => setMetaDue(e.target.value)}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor={`meta-notes-${structure.id}`}>
                <Input
                  id={`meta-notes-${structure.id}`}
                  value={metaNotes}
                  onChange={(e) => setMetaNotes(e.target.value)}
                  placeholder="Optional"
                />
              </FormField>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" variant="secondary" loading={savingMeta} onClick={() => void saveMeta()}>
                Save details
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelMeta}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2 md:hidden">
          {structure.lines.map((line) => (
            <LineMobileCard
              key={line.id}
              structureId={structure.id}
              line={line}
              editable={canEdit}
            />
          ))}
        </div>
        <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Fee item</TH>
              <TH>Amount</TH>
              <TH>Applies to</TH>
              {!readOnly && isDraft && <TH />}
            </TR>
          </THead>
          <TBody>
            {structure.lines.map((line) => (
              <LineRow
                key={line.id}
                structureId={structure.id}
                line={line}
                editable={canEdit}
              />
            ))}
          </TBody>
        </Table>
        </div>

        {!readOnly && isDraft && (
          <form className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleAddLine}>
            <FormField label="Label" htmlFor={`line-label-${structure.id}`} required>
              <Input
                id={`line-label-${structure.id}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Tuition"
              />
            </FormField>
            <FormField label="Amount (UGX)" htmlFor={`line-amt-${structure.id}`} required>
              <Input
                id={`line-amt-${structure.id}`}
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
            <FormField label="Applies to" htmlFor={`line-applies-${structure.id}`}>
              <Select
                id={`line-applies-${structure.id}`}
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value)}
              >
                <option value="all">All students</option>
                <option value="class_level">Specific class</option>
                <option value="day">Day students</option>
                <option value="boarder">Boarders</option>
              </Select>
            </FormField>
            {appliesTo === "class_level" && (
              <FormField label="Class" htmlFor={`line-cls-${structure.id}`}>
                <Select
                  id={`line-cls-${structure.id}`}
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                >
                  {ALL_CLASS_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <div className="flex items-end sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={adding}>
                {adding ? "Adding…" : "Add line"}
              </Button>
            </div>
          </form>
        )}

        {structure.status === "active" && (
          <p className="text-[12px] text-slate-500">
            Active structures are locked. Archive by activating a newer draft when term fees change.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function FeeStructuresView() {
  const user = useAppSelector((s) => s.auth.user);
  const readOnly = user?.role !== "school_admin";
  const { toast } = useToast();
  const { data: ctx } = useAcademicContextQuery();
  const termId = ctx?.active_term?.id;
  const { data: structures, isLoading, isError, error } = useFeeStructuresQuery(
    termId ? { termId } : undefined,
  );
  const [createStructure, { isLoading: creating }] = useCreateFeeStructureMutation();
  const [name, setName] = useState("");

  const sorted = useMemo(
    () => [...(structures ?? [])].sort((a, b) => {
      const rank = (s: FeeStructureOut) => (s.status === "active" ? 0 : s.status === "draft" ? 1 : 2);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    }),
    [structures],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createStructure({ name: name.trim(), termId }).unwrap();
      setName("");
      toast("Fee structure created.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message={parseError(error).message} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finance"
        title="Fee structures"
        description={
          readOnly
            ? "View term fee schedules configured by the school admin."
            : "Define term fee items by class or residence, then activate one structure before generating invoices."
        }
      />

      {!readOnly && (
        <Card>
          <CardHeader title="New structure" description="Draft structures can be edited until activated." />
          <CardBody>
            <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={handleCreate}>
              <FormField label="Name" htmlFor="structure-name" required>
                <Input
                  id="structure-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Term 1 2025 fees"
                  className="w-full sm:max-w-md"
                />
              </FormField>
              <Button type="submit" className="w-full sm:w-auto" disabled={creating}>
                {creating ? "Creating…" : "Create draft"}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {!sorted.length ? (
        <EmptyState
          title="No fee structures"
          description="Create a draft structure and add tuition, levies, and other term charges."
        />
      ) : (
        sorted.map((s) => <StructureEditor key={s.id} structure={s} readOnly={readOnly} />)
      )}
    </div>
  );
}
