"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import {
  CIRCULAR_AUDIENCE_OPTIONS,
  CIRCULAR_BEST_PRACTICES,
  CIRCULAR_PRIORITY_LABEL,
  CIRCULAR_STATUS_LABEL,
  circularAudienceLabel,
} from "@/lib/circularMeta";
import { downloadCircularAttachment, formatCircularDate } from "@/lib/circularUtils";
import { cn } from "@/lib/cn";
import type { CircularAudience, CircularOut, CircularPriority, CircularStatus, ClassOut } from "@/lib/types";
import {
  useCreateCircularMutation,
  useDeleteCircularAttachmentMutation,
  useDeleteCircularMutation,
  useListCircularsQuery,
  useListClassesQuery,
  usePublishCircularMutation,
  useUpdateCircularMutation,
  useUploadCircularAttachmentMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";

type Tab = "draft" | "published" | "archived";

const EMPTY_FORM = {
  title: "",
  body: "",
  audience: "all_parents" as CircularAudience,
  priority: "normal" as CircularPriority,
  class_id: "",
  stream_id: "",
};

function CircularRow({
  item,
  onChanged,
}: {
  item: CircularOut;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [publish] = usePublishCircularMutation();
  const [update] = useUpdateCircularMutation();
  const [remove] = useDeleteCircularMutation();
  const [uploadAttachment, { isLoading: uploading }] = useUploadCircularAttachmentMutation();
  const [deleteAttachment] = useDeleteCircularAttachmentMutation();

  async function handlePublish() {
    try {
      await publish(item.id).unwrap();
      toast("Circular published to the parent inbox.", "success");
      onChanged();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function handleArchive() {
    try {
      await update({ circularId: item.id, body: { status: "archived" } }).unwrap();
      toast("Circular archived.", "success");
      onChanged();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete circular",
      description: `Remove "${item.title}" permanently?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove(item.id).unwrap();
      toast("Circular deleted.", "success");
      onChanged();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function handleAttachment(file: File | null) {
    if (!file) return;
    try {
      await uploadAttachment({ circularId: item.id, file }).unwrap();
      toast("Attachment uploaded.", "success");
      onChanged();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function handleRemoveAttachment() {
    try {
      await deleteAttachment(item.id).unwrap();
      toast("Attachment removed.", "success");
      onChanged();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[13px] font-semibold text-slate-900">{item.title}</h4>
            {item.priority === "important" ? <Badge tone="amber">Important</Badge> : null}
            <Badge tone={item.status === "published" ? "green" : item.status === "draft" ? "blue" : "neutral"}>
              {CIRCULAR_STATUS_LABEL[item.status]}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {circularAudienceLabel(item.audience, item.class_label, item.stream_label)}
            {item.published_at ? ` · Published ${formatCircularDate(item.published_at)}` : ` · Updated ${formatCircularDate(item.updated_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Preview"}
          </Button>
          {item.status === "draft" ? (
            <Button size="sm" onClick={() => void handlePublish()}>
              Publish
            </Button>
          ) : null}
          {item.status === "published" ? (
            <Button size="sm" variant="secondary" onClick={() => void handleArchive()}>
              Archive
            </Button>
          ) : null}
          {item.status !== "published" ? (
            <Button size="sm" variant="ghost" onClick={() => void handleDelete()}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{item.body}</p>
          <div className="flex flex-wrap items-center gap-2">
            {item.has_attachment ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void downloadCircularAttachment(
                      item.id,
                      item.attachment_filename ?? "attachment",
                      accessToken,
                    ).catch(() => toast("Download failed.", "error"))
                  }
                >
                  <Icon name="arrow-down" size={13} />
                  {item.attachment_filename ?? "Attachment"}
                </Button>
                {item.status === "draft" ? (
                  <Button size="sm" variant="ghost" onClick={() => void handleRemoveAttachment()}>
                    Remove file
                  </Button>
                ) : null}
              </>
            ) : item.status === "draft" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void handleAttachment(e.target.files?.[0] ?? null)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  Add PDF or image
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CircularsSettingsView() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("draft");
  const [showTips, setShowTips] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const { data: classes = [] } = useListClassesQuery();
  const { data: circulars = [], isLoading, isError, refetch } = useListCircularsQuery();
  const [createCircular, { isLoading: creating }] = useCreateCircularMutation();

  const selectedClass = classes.find((c) => c.id === form.class_id);
  const streams = selectedClass?.streams ?? [];

  const filtered = useMemo(
    () => circulars.filter((c) => c.status === tab),
    [circulars, tab],
  );

  const counts = useMemo(
    () => ({
      draft: circulars.filter((c) => c.status === "draft").length,
      published: circulars.filter((c) => c.status === "published").length,
      archived: circulars.filter((c) => c.status === "archived").length,
    }),
    [circulars],
  );

  async function saveDraft() {
    if (!form.title.trim() || !form.body.trim()) {
      toast("Title and message are required.", "error");
      return;
    }
    try {
      await createCircular({
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        priority: form.priority,
        class_id: form.audience !== "all_parents" ? form.class_id || null : null,
        stream_id: form.audience === "stream" ? form.stream_id || null : null,
      }).unwrap();
      toast("Draft saved. Review and publish when ready.", "success");
      setForm(EMPTY_FORM);
      setTab("draft");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load circulars." />;

  return (
    <div className="space-y-4">
      {showTips ? (
        <Card>
          <CardHeader
            icon={<Icon name="chat" size={13} />}
            title="Getting the most from circulars"
            description="Research-backed tips for parent communication that gets read."
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowTips(false)}>
                Dismiss
              </Button>
            }
          />
          <CardBody>
            <ul className="grid gap-3 sm:grid-cols-2">
              {CIRCULAR_BEST_PRACTICES.map((tip) => (
                <li key={tip.title} className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100">
                  <p className="text-[12px] font-semibold text-slate-800">{tip.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{tip.body}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={<Icon name="plus" size={13} />}
          title="Compose circular"
          description="Write the notice in plain language. Parents see published items in their portal inbox."
        />
        <CardBody className="space-y-3">
          <FormField label="Title" required hint="Lead with the date or action — e.g. “Visitation — Saturday 15 March”">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Short, scannable headline"
            />
          </FormField>
          <FormField label="Message" required hint="First sentence should answer: what, when, and what parents need to do.">
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={6}
              placeholder="Dear parents,&#10;&#10;School closes at 12:00 noon on Friday for staff development. Normal time resumes Monday."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Audience">
              <Select
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audience: e.target.value as CircularAudience,
                    class_id: "",
                    stream_id: "",
                  }))
                }
              >
                {CIRCULAR_AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as CircularPriority }))
                }
              >
                <option value="normal">{CIRCULAR_PRIORITY_LABEL.normal}</option>
                <option value="important">{CIRCULAR_PRIORITY_LABEL.important}</option>
              </Select>
            </FormField>
            {form.audience !== "all_parents" ? (
              <FormField label="Class" required>
                <Select
                  value={form.class_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, class_id: e.target.value, stream_id: "" }))
                  }
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            {form.audience === "stream" ? (
              <FormField label="Stream" required>
                <Select
                  value={form.stream_id}
                  onChange={(e) => setForm((f) => ({ ...f, stream_id: e.target.value }))}
                >
                  <option value="">Select stream</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500">
            {CIRCULAR_AUDIENCE_OPTIONS.find((o) => o.id === form.audience)?.hint}
          </p>
          <Button size="sm" loading={creating} onClick={() => void saveDraft()}>
            Save as draft
          </Button>
        </CardBody>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["draft", "published", "archived"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                tab === key
                  ? "border-brand-300 bg-brand-50 text-brand-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {CIRCULAR_STATUS_LABEL[key]}
              <span className="tabular-nums text-slate-400">{counts[key]}</span>
            </button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Icon name="chat" size={18} />}
            title={`No ${CIRCULAR_STATUS_LABEL[tab].toLowerCase()} circulars`}
            description={
              tab === "draft"
                ? "Compose a notice above. You can attach a PDF after saving the draft."
                : "Published circulars appear in the parent portal inbox."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <CircularRow key={item.id} item={item} onChanged={() => void refetch()} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
