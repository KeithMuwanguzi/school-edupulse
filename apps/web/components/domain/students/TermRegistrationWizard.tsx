"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { WizardFlow } from "@/components/ui/WizardFlow";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import type {
  RegistrationRequirementOut,
  RegistrationSectionProgressOut,
} from "@/lib/types";
import {
  useCompleteRegistrationMutation,
  useGetRegistrationQuery,
  useUpsertRegistrationResponsesMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";

const compact = "h-9 text-[13px] sm:h-7 sm:text-[12px]";

type DraftValues = Record<string, string | boolean | number | "">;

function responseMap(section: RegistrationSectionProgressOut) {
  const map: Record<
    string,
    {
      value?: unknown;
      status: string;
      notes?: string | null;
      recorded_by_name?: string | null;
      recorded_at?: string | null;
    }
  > = {};
  for (const r of section.responses) {
    map[r.requirement_id] = r;
  }
  return map;
}

function draftsFromSection(section: RegistrationSectionProgressOut): DraftValues {
  const resp = responseMap(section);
  const drafts: DraftValues = {};
  for (const req of section.requirements) {
    const hit = resp[req.id];
    if (hit?.value !== undefined && hit.value !== null) {
      drafts[req.id] = hit.value as string | boolean | number;
    } else if (req.field_type === "checkbox") {
      drafts[req.id] = false;
    } else {
      drafts[req.id] = "";
    }
  }
  return drafts;
}

export function TermRegistrationWizard({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useGetRegistrationQuery(registrationId);
  const [upsertResponses, { isLoading: saving }] = useUpsertRegistrationResponsesMutation();
  const [completeRegistration, { isLoading: completing }] = useCompleteRegistrationMutation();

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftValues>({});

  const activeSection = useMemo(
    () => data?.sections.find((s) => s.section_id === activeSectionId) ?? data?.sections[0],
    [data, activeSectionId],
  );

  const steps = useMemo(
    () =>
      (data?.sections ?? []).map((sec) => ({
        id: sec.section_id,
        label: sec.label,
        complete: sec.is_complete,
      })),
    [data?.sections],
  );

  useEffect(() => {
    if (!data?.sections.length) return;
    if (activeSectionId) return;
    const firstOpen =
      data.sections.find((s) => !s.is_complete)?.section_id ?? data.sections[0].section_id;
    setActiveSectionId(firstOpen);
  }, [data, activeSectionId]);

  useEffect(() => {
    if (activeSection) {
      setDrafts(draftsFromSection(activeSection));
    }
  }, [activeSection]);

  const saveSection = useCallback(
    async (advance = false) => {
      if (!activeSection || data?.status === "complete") return false;
      const responses = activeSection.requirements.map((req) => {
        const raw = drafts[req.id];
        let value: string | boolean | number | null = raw === "" ? null : raw;
        if (req.field_type === "checkbox") value = raw === true;
        return {
          requirement_id: req.id,
          value,
          status:
            req.field_type === "checkbox" && value !== true && req.is_required
              ? "pending"
              : "satisfied",
        };
      });

      try {
        await upsertResponses({ registrationId, responses }).unwrap();
        toast(`${activeSection.label} saved.`, "success");
        const refreshed = await refetch();
        const sections = refreshed.data?.sections ?? data?.sections ?? [];
        if (advance && sections.length > 0) {
          const idx = sections.findIndex((s) => s.section_id === activeSection.section_id);
          const next = sections.slice(idx + 1).find((s) => !s.is_complete);
          if (next) setActiveSectionId(next.section_id);
        }
        return true;
      } catch (err) {
        const p = parseError(err);
        toast(p.message, "error", p.requestId);
        return false;
      }
    },
    [activeSection, data?.sections, data?.status, drafts, refetch, registrationId, toast, upsertResponses],
  );

  if (isLoading || !data) return <PageLoader />;
  if (isError) {
    return (
      <EmptyState
        icon={<Icon name="alert-triangle" size={18} />}
        title="Could not load registration"
        description="The registration record may be missing or you may not have access."
        action={
          <Button size="sm" variant="secondary" onClick={() => router.push("/app/m/students/term")}>
            Back to queue
          </Button>
        }
      />
    );
  }

  const readOnly = data.status === "complete";
  const pct =
    data.required_total > 0
      ? Math.round((data.required_done / data.required_total) * 100)
      : 0;
  const activeIndex = steps.findIndex((s) => s.id === activeSectionId);

  async function finalize() {
    try {
      await completeRegistration(registrationId).unwrap();
      toast("Registration complete.", "success");
      await refetch();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <Card>
        <CardHeader
          title={`${data.first_name} ${data.last_name}`}
          description={`#${data.student_number} · ${data.term_label}${data.class_level ? ` · ${data.class_level}` : ""}`}
          action={
            <button
              type="button"
              onClick={() => router.push("/app/m/students/term")}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
            >
              Back
            </button>
          }
        />
        <CardBody className="space-y-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={data.status === "complete" ? "green" : "gold"} dot>
              {data.status === "complete" ? "Complete" : "In progress"}
            </Badge>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="h-2 min-w-[5rem] flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", pct === 100 ? "bg-brand-600" : "bg-gold-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] text-slate-500">
                {data.required_done}/{data.required_total} required
              </span>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Work through each section in order. Save and continue to move to the next check.
          </p>
        </CardBody>
      </Card>

      {data.sections.length === 0 ? (
        <Card>
          <CardBody className="py-6 text-center text-[12px] text-slate-500">
            No registration sections configured yet. Ask an admin to set them up under Settings →
            Term registration.
          </CardBody>
        </Card>
      ) : activeSection && activeSectionId ? (
        <Card>
          <CardBody className="py-4">
            <WizardFlow
              steps={steps}
              activeStepId={activeSectionId}
              onStepChange={setActiveSectionId}
              readOnly={readOnly}
              saving={saving}
              onBack={() => {
                if (activeIndex > 0) {
                  setActiveSectionId(steps[activeIndex - 1].id);
                }
              }}
              onSave={() => void saveSection(false)}
              onNext={() => void saveSection(true)}
              saveLabel="Save section"
              nextLabel={
                activeIndex < steps.length - 1 ? "Save & next section" : "Save section"
              }
              extraActions={
                !readOnly &&
                data.required_done >= data.required_total &&
                data.required_total > 0 ? (
                  <Button size="sm" loading={completing} onClick={() => void finalize()}>
                    Mark complete
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900">{activeSection.label}</h3>
                  <p className="text-[11px] text-slate-400">
                    {activeSection.required_done} of {activeSection.required_total} required items
                    done
                  </p>
                </div>
                {activeSection.requirements.map((req) => (
                  <RequirementField
                    key={req.id}
                    req={req}
                    value={drafts[req.id]}
                    existing={responseMap(activeSection)[req.id]}
                    readOnly={readOnly}
                    onChange={(v) => setDrafts((prev) => ({ ...prev, [req.id]: v }))}
                  />
                ))}
              </div>
            </WizardFlow>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function RequirementField({
  req,
  value,
  existing,
  readOnly,
  onChange,
}: {
  req: RegistrationRequirementOut;
  value: string | boolean | number | "" | undefined;
  existing?: {
    recorded_by_name?: string | null;
    recorded_at?: string | null;
    status: string;
  };
  readOnly: boolean;
  onChange: (v: string | boolean | number | "") => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-3 sm:p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-slate-800 sm:text-[12px]">
            {req.label}
            {req.is_required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {req.description && (
            <p className="text-[11px] text-slate-400">{req.description}</p>
          )}
        </div>
        {existing?.status === "waived" && <Badge tone="neutral">Waived</Badge>}
      </div>

      {req.field_type === "checkbox" ? (
        <label className="flex min-h-[44px] items-center gap-2 text-[13px] text-slate-600 sm:text-[12px]">
          <input
            type="checkbox"
            checked={value === true}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Verified
        </label>
      ) : req.field_type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] sm:text-[12px]"
        />
      ) : req.field_type === "select" ? (
        <Select
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className={compact}
        >
          <option value="">—</option>
          {(req.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={req.field_type === "date" ? "date" : req.field_type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) =>
            onChange(req.field_type === "number" ? Number(e.target.value) : e.target.value)
          }
          className={compact}
        />
      )}

      {existing?.recorded_by_name && (
        <p className="mt-2 text-[10px] text-slate-400">
          Checked by {existing.recorded_by_name}
          {existing.recorded_at
            ? ` · ${new Date(existing.recorded_at).toLocaleString()}`
            : ""}
        </p>
      )}
    </div>
  );
}
