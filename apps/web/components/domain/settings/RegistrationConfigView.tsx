"use client";

import { useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { Badge } from "@/components/ui/Badge";
import { SettingsHint } from "@/components/layout/settingsUi";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import type { RegistrationRequirementOut, RegistrationSectionOut } from "@/lib/types";
import {
  useCreateRegistrationRequirementMutation,
  useCreateRegistrationSectionMutation,
  useDeleteRegistrationRequirementMutation,
  useDeleteRegistrationSectionMutation,
  useGetRegistrationConfigQuery,
  useReorderRegistrationSectionsMutation,
  useUpdateRegistrationRequirementMutation,
  useUpdateRegistrationSectionMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

const compact = "h-7 text-[12px]";
const FIELD_TYPES = [
  { value: "checkbox", label: "Yes / No check" },
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
];

export function RegistrationConfigView() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch, isFetching } = useGetRegistrationConfigQuery();
  const [createSection, { isLoading: creatingSection }] = useCreateRegistrationSectionMutation();
  const [updateSection] = useUpdateRegistrationSectionMutation();
  const [deleteSection] = useDeleteRegistrationSectionMutation();
  const [createRequirement, { isLoading: creatingReq }] = useCreateRegistrationRequirementMutation();
  const [updateRequirement] = useUpdateRegistrationRequirementMutation();
  const [deleteRequirement] = useDeleteRegistrationRequirementMutation();
  const [reorderSections, { isLoading: reordering }] = useReorderRegistrationSectionsMutation();
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newReqLabel, setNewReqLabel] = useState<Record<string, string>>({});

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <ErrorBanner message="Couldn't load the registration checklist. Please refresh and try again." />
    );

  async function addSection() {
    if (!newSectionLabel.trim()) return;
    try {
      const sec = await createSection({ label: newSectionLabel.trim() }).unwrap();
      setNewSectionLabel("");
      setExpanded(sec.id);
      toast("Section added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addRequirement(sectionId: string) {
    const label = (newReqLabel[sectionId] ?? "").trim();
    if (!label) return;
    try {
      await createRequirement({
        sectionId,
        body: { label, field_type: "checkbox", is_required: true },
      }).unwrap();
      setNewReqLabel((prev) => ({ ...prev, [sectionId]: "" }));
      toast("Requirement added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function reorderSectionsByIds(ids: string[]) {
    try {
      await reorderSections({ section_ids: ids }).unwrap();
      toast("Section order updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  function handleSectionDrop(targetId: string) {
    if (!dragSectionId || dragSectionId === targetId) return;
    const ids = data!.sections.map((s) => s.id);
    const fromIdx = ids.indexOf(dragSectionId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragSectionId);
    setDragSectionId(null);
    void reorderSectionsByIds(ids);
  }

  return (
    <div className="space-y-4">
      <PageToolbar className="items-start">
        <SettingsHint>
          Define the sections staff check when learners return each term. Drag collapsed sections to
          reorder the check-in wizard. Mark items as required or optional.
        </SettingsHint>
        <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh registration config" />
      </PageToolbar>

      <Card>
        <CardHeader
          icon={<Icon name="plus" size={13} />}
          title="Add section"
          description="Group related requirements (e.g. Finance, Health, Documents)."
        />
        <CardBody className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <FormField label="Section name" required>
            <Input
              value={newSectionLabel}
              onChange={(e) => setNewSectionLabel(e.target.value)}
              placeholder="e.g. Transport"
              className={cn(compact, "w-full sm:max-w-md")}
            />
          </FormField>
          <Button size="sm" className="w-full sm:w-auto" loading={creatingSection} onClick={() => void addSection()}>
            Add section
          </Button>
        </CardBody>
      </Card>

      {data.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          expanded={expanded === section.id}
          dragging={dragSectionId === section.id}
          reordering={reordering}
          onDragStart={() => setDragSectionId(section.id)}
          onDragEnd={() => setDragSectionId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleSectionDrop(section.id)}
          onToggle={() => setExpanded((id) => (id === section.id ? null : section.id))}
          newReqLabel={newReqLabel[section.id] ?? ""}
          onNewReqLabelChange={(v) => setNewReqLabel((prev) => ({ ...prev, [section.id]: v }))}
          onAddRequirement={() => void addRequirement(section.id)}
          addingReq={creatingReq}
          onUpdateSection={(body) =>
            updateSection({ sectionId: section.id, body }).unwrap().catch((err) => {
              toast(parseError(err).message, "error");
            })
          }
          onDeleteSection={() =>
            deleteSection(section.id)
              .unwrap()
              .then(() => toast("Section removed.", "success"))
              .catch((err) => toast(parseError(err).message, "error"))
          }
          onUpdateRequirement={(reqId, body) =>
            updateRequirement({ requirementId: reqId, body })
              .unwrap()
              .catch((err) => toast(parseError(err).message, "error"))
          }
          onDeleteRequirement={(reqId) =>
            deleteRequirement(reqId)
              .unwrap()
              .catch((err) => toast(parseError(err).message, "error"))
          }
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  expanded,
  dragging,
  reordering,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggle,
  newReqLabel,
  onNewReqLabelChange,
  onAddRequirement,
  addingReq,
  onUpdateSection,
  onDeleteSection,
  onUpdateRequirement,
  onDeleteRequirement,
}: {
  section: RegistrationSectionOut;
  expanded: boolean;
  dragging?: boolean;
  reordering: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
  onToggle: () => void;
  newReqLabel: string;
  onNewReqLabelChange: (v: string) => void;
  onAddRequirement: () => void;
  addingReq: boolean;
  onUpdateSection: (body: Record<string, unknown>) => void;
  onDeleteSection: () => void;
  onUpdateRequirement: (reqId: string, body: Record<string, unknown>) => void;
  onDeleteRequirement: (reqId: string) => void;
}) {
  return (
    <div
      draggable={!expanded && !reordering}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        dragging && "opacity-60",
        !expanded && !reordering && "cursor-grab active:cursor-grabbing",
      )}
    >
      <Card className={cn(dragging && "ring-2 ring-brand-300")}>
      <div className="flex items-stretch">
        {!expanded && (
          <div
            className="flex w-9 shrink-0 items-center justify-center border-r border-slate-100 text-slate-300"
            aria-hidden
          >
            <Icon name="grip" size={14} />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {section.icon && <Icon name={section.icon} size={14} className="shrink-0 text-brand-600" />}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-800">{section.label}</p>
              {section.description && (
                <p className="truncate text-[11px] text-slate-400">{section.description}</p>
              )}
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-2">
            <Badge tone="neutral">{section.requirements.length} items</Badge>
            <Icon
              name="chevron-down"
              size={14}
              className={cn("text-slate-400 transition-transform", expanded && "rotate-180")}
            />
          </div>
        </button>
      </div>

      {expanded && (
        <CardBody className="space-y-3 border-t border-slate-100 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label="Label">
              <Input
                defaultValue={section.label}
                className={compact}
                onBlur={(e) => {
                  if (e.target.value !== section.label) onUpdateSection({ label: e.target.value });
                }}
              />
            </FormField>
            <FormField label="Description">
              <Input
                defaultValue={section.description ?? ""}
                className={compact}
                onBlur={(e) =>
                  onUpdateSection({ description: e.target.value || null })
                }
              />
            </FormField>
          </div>

          <div className="space-y-2">
            {section.requirements.map((req) => (
              <RequirementRow
                key={req.id}
                req={req}
                onUpdate={(body) => onUpdateRequirement(req.id, body)}
                onDelete={() => onDeleteRequirement(req.id)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-50 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FormField label="New requirement" required>
              <Input
                value={newReqLabel}
                onChange={(e) => onNewReqLabelChange(e.target.value)}
                placeholder="e.g. PTA fee paid"
                className={compact}
              />
            </FormField>
            <Button size="sm" variant="secondary" className="w-full sm:w-auto" loading={addingReq} onClick={onAddRequirement}>
              Add item
            </Button>
            <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={onDeleteSection}>
              Remove section
            </Button>
          </div>
        </CardBody>
      )}
      </Card>
    </div>
  );
}

function RequirementRow({
  req,
  onUpdate,
  onDelete,
}: {
  req: RegistrationRequirementOut;
  onUpdate: (body: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [optionsText, setOptionsText] = useState((req.options ?? []).join(", "));

  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5 md:space-y-0 md:grid md:gap-2 md:grid-cols-12 md:items-center">
      <div className="md:col-span-4">
        <FormField label="Label">
          <Input
            defaultValue={req.label}
            className={compact}
            onBlur={(e) => {
              if (e.target.value !== req.label) onUpdate({ label: e.target.value });
            }}
          />
        </FormField>
      </div>
      <div className="md:col-span-2">
        <FormField label="Field type">
          <Select
            value={req.field_type}
            onChange={(e) => onUpdate({ field_type: e.target.value })}
            className={compact}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="md:col-span-2">
        <label className="flex items-center gap-1.5 pt-5 text-[11px] text-slate-600 md:pt-0">
          <input
            type="checkbox"
            checked={req.is_required}
            onChange={(e) => onUpdate({ is_required: e.target.checked })}
            className="rounded border-slate-300"
          />
          Required
        </label>
      </div>
      {req.field_type === "select" && (
        <div className="md:col-span-3">
          <FormField label="Options">
            <Input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Option A, Option B"
              className={compact}
              onBlur={() =>
                onUpdate({
                  options: optionsText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </FormField>
        </div>
      )}
      <div className="md:col-span-1 md:text-right">
        <Button size="sm" variant="ghost" className="w-full md:w-auto" onClick={onDelete}>
          Remove
        </Button>
      </div>
    </div>
  );
}
