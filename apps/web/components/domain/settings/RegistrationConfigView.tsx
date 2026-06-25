"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { RefreshButton } from "@/components/ui/RefreshButton";
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

  async function moveSection(sectionId: string, direction: -1 | 1) {
    const sections = data!.sections;
    const ids = sections.map((s) => s.id);
    const idx = ids.indexOf(sectionId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      await reorderSections({ section_ids: ids }).unwrap();
      toast("Section order updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <SettingsHint>
          Define the sections staff check when learners return each term. Mark items as required or
          optional — each school configures its own checklist.
        </SettingsHint>
        <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh registration config" />
      </div>

      <Card>
        <CardHeader
          icon={<Icon name="plus" size={13} />}
          title="Add section"
          description="Group related requirements (e.g. Finance, Health, Documents)."
        />
        <CardBody className="flex flex-wrap items-end gap-2">
          <FormField label="Section name" required>
            <Input
              value={newSectionLabel}
              onChange={(e) => setNewSectionLabel(e.target.value)}
              placeholder="e.g. Transport"
              className={cn(compact, "max-w-md")}
            />
          </FormField>
          <Button size="sm" loading={creatingSection} onClick={() => void addSection()}>
            Add section
          </Button>
        </CardBody>
      </Card>

      {data.sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          expanded={expanded === section.id}
          canMoveUp={index > 0}
          canMoveDown={index < data.sections.length - 1}
          reordering={reordering}
          onMoveUp={() => void moveSection(section.id, -1)}
          onMoveDown={() => void moveSection(section.id, 1)}
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
  canMoveUp,
  canMoveDown,
  reordering,
  onMoveUp,
  onMoveDown,
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
  canMoveUp: boolean;
  canMoveDown: boolean;
  reordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
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
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          {section.icon && <Icon name={section.icon} size={14} className="text-brand-600" />}
          <div>
            <p className="text-[13px] font-semibold text-slate-800">{section.label}</p>
            {section.description && (
              <p className="text-[11px] text-slate-400">{section.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canMoveUp || reordering}
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              aria-label="Move section up"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            >
              <Icon name="arrow-up-right" size={12} className="-rotate-45" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown || reordering}
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              aria-label="Move section down"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            >
              <Icon name="arrow-down" size={12} />
            </button>
          </div>
          <Badge tone="neutral">{section.requirements.length} items</Badge>
          <Icon
            name="chevron-down"
            size={14}
            className={cn("text-slate-400 transition-transform", expanded && "rotate-180")}
          />
        </div>
      </button>

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

          <div className="flex flex-wrap items-end gap-2 border-t border-slate-50 pt-3">
            <FormField label="New requirement" required>
              <Input
                value={newReqLabel}
                onChange={(e) => onNewReqLabelChange(e.target.value)}
                placeholder="e.g. PTA fee paid"
                className={compact}
              />
            </FormField>
            <Button size="sm" variant="secondary" loading={addingReq} onClick={onAddRequirement}>
              Add item
            </Button>
            <Button size="sm" variant="ghost" onClick={onDeleteSection}>
              Remove section
            </Button>
          </div>
        </CardBody>
      )}
    </Card>
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
    <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5 sm:grid-cols-12 sm:items-center">
      <div className="sm:col-span-4">
        <Input
          defaultValue={req.label}
          className={compact}
          onBlur={(e) => {
            if (e.target.value !== req.label) onUpdate({ label: e.target.value });
          }}
        />
      </div>
      <div className="sm:col-span-2">
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
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
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
        <div className="sm:col-span-3">
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
        </div>
      )}
      <div className="sm:col-span-1 sm:text-right">
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] text-slate-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
