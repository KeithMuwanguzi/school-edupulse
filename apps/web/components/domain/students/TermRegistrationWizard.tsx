"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SettingsHint } from "@/components/layout/settingsUi";
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

const compact = "h-7 text-[12px]";

type DraftValues = Record<string, string | boolean | number | "">;

function responseMap(section: RegistrationSectionProgressOut) {
  const map: Record<string, { value?: unknown; status: string; notes?: string | null; recorded_by_name?: string | null; recorded_at?: string | null }> = {};
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

  useEffect(() => {
    if (data?.sections.length && !activeSectionId) {
      setActiveSectionId(data.sections[0].section_id);
    }
  }, [data, activeSectionId]);

  useEffect(() => {
    if (activeSection) {
      setDrafts(draftsFromSection(activeSection));
    }
  }, [activeSection]);

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

  async function saveSection() {
    if (!activeSection || readOnly) return;
    const responses = activeSection.requirements.map((req) => {
      const raw = drafts[req.id];
      let value: string | boolean | number | null = raw === "" ? null : raw;
      if (req.field_type === "checkbox") value = raw === true;
      return {
        requirement_id: req.id,
        value,
        status: req.field_type === "checkbox" && value !== true && req.is_required ? "pending" : "satisfied",
      };
    });

    try {
      await upsertResponses({ registrationId, responses }).unwrap();
      toast(`${activeSection.label} saved.`, "success");
      await refetch();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

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
    <div className="space-y-4">
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
              Back to queue
            </button>
          }
        />
        <CardBody className="space-y-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={data.status === "complete" ? "green" : "gold"} dot>
              {data.status === "complete" ? "Complete" : "In progress"}
            </Badge>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", pct === 100 ? "bg-brand-600" : "bg-gold-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {data.required_done}/{data.required_total} required · {data.sections_complete}/
                {data.sections_total} sections
              </span>
            </div>
          </div>
          <SettingsHint>
            Staff can work on different sections independently — open Finance, Health, or any other
            tab and save your checks. Registration completes when all required items are satisfied.
          </SettingsHint>
        </CardBody>
      </Card>

      {data.sections.length === 0 ? (
        <Card>
          <CardBody className="py-6 text-center text-[12px] text-slate-500">
            No registration sections configured yet. Ask an admin to set them up under Settings →
            Term registration.
          </CardBody>
        </Card>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <CardBody className="space-y-1 p-2">
            {data.sections.map((sec) => (
              <button
                key={sec.section_id}
                type="button"
                onClick={() => setActiveSectionId(sec.section_id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] transition-colors",
                  activeSection?.section_id === sec.section_id
                    ? "bg-brand-50 font-medium text-brand-800 ring-1 ring-brand-200"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-2">
                  {sec.icon && <Icon name={sec.icon} size={13} />}
                  {sec.label}
                </span>
                {sec.is_complete ? (
                  <Icon name="check" size={13} className="text-brand-600" />
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {sec.required_done}/{sec.required_total}
                  </span>
                )}
              </button>
            ))}
          </CardBody>
        </Card>

        {activeSection && (
          <Card>
            <CardHeader
              title={activeSection.label}
              description={`${activeSection.required_done} of ${activeSection.required_total} required items done`}
            />
            <CardBody className="space-y-4 py-3">
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

              {!readOnly && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="secondary" loading={saving} onClick={() => void saveSection()}>
                    Save {activeSection.label}
                  </Button>
                  {data.required_done >= data.required_total && data.required_total > 0 && (
                    <Button size="sm" loading={completing} onClick={() => void finalize()}>
                      Mark registration complete
                    </Button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
      )}
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
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-slate-800">
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
        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <input
            type="checkbox"
            checked={value === true}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-slate-300"
          />
          Verified
        </label>
      ) : req.field_type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
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
