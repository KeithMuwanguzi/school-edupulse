"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { useToast } from "@/components/ui/Toast";
import { circularAudienceLabel, CIRCULAR_PRIORITY_LABEL } from "@/lib/circularMeta";
import { downloadCircularAttachment, formatCircularDate } from "@/lib/circularUtils";
import { cn } from "@/lib/cn";
import type { CircularOut } from "@/lib/types";
import { useListCircularInboxQuery } from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";

function CircularDetail({ item, onClose }: { item: CircularOut; onClose: () => void }) {
  const { toast } = useToast();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-slate-900">{item.title}</h2>
              {item.priority === "important" ? (
                <Badge tone="amber">{CIRCULAR_PRIORITY_LABEL.important}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {circularAudienceLabel(item.audience, item.class_label, item.stream_label)} ·{" "}
              {formatCircularDate(item.published_at)}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Back
          </Button>
        </div>
        <div className="whitespace-pre-wrap rounded-xl bg-slate-50/80 p-4 text-[13px] leading-relaxed text-slate-800 ring-1 ring-slate-100">
          {item.body}
        </div>
        {item.has_attachment ? (
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
            {item.attachment_filename ?? "Download attachment"}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function CircularsInboxView({
  title = "School circulars",
  description = "Notices from your school. Important updates appear at the top.",
}: {
  title?: string;
  description?: string;
}) {
  const { data: items = [], isLoading, isError, refetch, isFetching } = useListCircularInboxQuery();
  const [selected, setSelected] = useState<CircularOut | null>(null);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load circulars." />;

  if (selected) {
    return <CircularDetail item={selected} onClose={() => setSelected(null)} />;
  }

  const sorted = [...items].sort((a, b) => {
    if (a.priority === "important" && b.priority !== "important") return -1;
    if (b.priority === "important" && a.priority !== "important") return 1;
    return (b.published_at ?? "").localeCompare(a.published_at ?? "");
  });

  return (
    <div className="space-y-4 animate-fade-rise">
      <PageHeader
        eyebrow="Communication"
        title={title}
        description={description}
        action={<RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh" />}
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Icon name="chat" size={18} />}
          title="No circulars yet"
          description="When the school publishes a notice, it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className={cn(
                "w-full rounded-xl border bg-white p-4 text-left shadow-card transition hover:border-brand-200 hover:shadow-lift",
                item.priority === "important" ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">{item.title}</span>
                    {item.priority === "important" ? (
                      <Badge tone="amber">{CIRCULAR_PRIORITY_LABEL.important}</Badge>
                    ) : null}
                    {item.has_attachment ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <Icon name="book" size={11} />
                        Attachment
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-slate-600">{item.body}</p>
                  <p className="mt-2 text-[10px] text-slate-400">{formatCircularDate(item.published_at)}</p>
                </div>
                <Icon name="chevron-right" size={16} className="mt-1 shrink-0 text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
