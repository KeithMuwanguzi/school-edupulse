"use client";

import { useState } from "react";
import { SettingsStatRow } from "@/components/layout/settingsUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageLoader } from "@/components/ui/Spinner";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import type { ClassOut } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { InlineAssignmentManager } from "@/components/domain/teachers/InlineAssignmentManager";
import {
  ALL_CLASS_LEVELS,
  NURSERY_LEVELS,
  PRIMARY_LEVELS,
  SECTION_LABELS,
} from "@/lib/schoolLevels";
import {
  useCreateClassMutation,
  useCreateStreamMutation,
  useDeleteClassMutation,
  useDeleteStreamMutation,
  useListClassesQuery,
  useSetupNurseryClassesMutation,
  useSetupPrimaryClassesMutation,
  useUpdateClassMutation,
  useUpdateStreamMutation,
} from "@/store/api/skulpulseApi";

function ClassPanel({ row }: { row: ClassOut }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const isAdmin = useAppSelector((s) => s.auth.user?.role === "school_admin");
  const hasTeachers = useAppSelector((s) => s.auth.user?.modules.includes("teachers") ?? false);
  const [label, setLabel] = useState(row.label);
  const [active, setActive] = useState(row.is_active);
  const [streamName, setStreamName] = useState("");
  const [updateClass, { isLoading: saving }] = useUpdateClassMutation();
  const [deleteClass, { isLoading: removing }] = useDeleteClassMutation();
  const [createStream, { isLoading: addingStream }] = useCreateStreamMutation();
  const [deleteStream, { isLoading: removingStream }] = useDeleteStreamMutation();
  const [updateStream, { isLoading: renamingStream }] = useUpdateStreamMutation();

  async function saveClass() {
    try {
      await updateClass({
        classId: row.id,
        body: { label: label.trim(), is_active: active },
      }).unwrap();
      toast("Class saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function removeClass() {
    const ok = await confirm({
      title: "Remove class",
      description: `Remove ${row.level} and all its streams? Learners in this class may need reassignment.`,
      confirmLabel: "Remove class",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteClass(row.id).unwrap();
      toast(`${row.level} removed.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addStream() {
    const name = streamName.trim();
    if (!name) return;
    try {
      await createStream({ classId: row.id, name }).unwrap();
      toast(`Stream ${name} added.`, "success");
      setStreamName("");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function renameStream(streamId: string, name: string, current: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === current) return;
    try {
      await updateStream({
        classId: row.id,
        streamId,
        body: { name: trimmed },
      }).unwrap();
      toast("Stream renamed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function removeStream(streamId: string, name: string) {
    const ok = await confirm({
      title: "Remove stream",
      description: `Remove stream ${name} from ${row.level}?`,
      confirmLabel: "Remove stream",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteStream({ classId: row.id, streamId }).unwrap();
      toast("Stream removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`${row.level} · ${row.label}`}
        description={
          row.streams.length
            ? `${row.streams.length} stream${row.streams.length === 1 ? "" : "s"}`
            : "No streams — add sections like A or B."
        }
        action={
          row.is_active ? (
            <Badge tone="green">Active</Badge>
          ) : (
            <Badge tone="neutral">Inactive</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {isAdmin && (
            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <FormField label="Display name">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </FormField>
              <label className="flex items-center gap-2 pb-2 text-[12px] text-slate-600">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Class active
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" loading={saving} className="flex-1 sm:flex-none" onClick={saveClass}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" loading={removing} className="flex-1 sm:flex-none" onClick={removeClass}>
                  Remove
                </Button>
              </div>
            </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium text-slate-500">Streams</p>
          {row.streams.length === 0 ? (
            <p className="text-[12px] text-slate-500">No streams yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {row.streams.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700"
                >
                  {isAdmin ? (
                    <Input
                      defaultValue={s.name}
                      disabled={renamingStream}
                      onBlur={(e) => void renameStream(s.id, e.target.value, s.name)}
                      className="h-6 w-16 border-0 bg-transparent px-0 py-0 text-[12px] font-semibold shadow-none focus:ring-0"
                      aria-label={`Rename stream ${s.name}`}
                    />
                  ) : (
                    <span className="font-semibold">{s.name}</span>
                  )}
                  {!s.is_active && (
                    <span className="text-[10px] text-slate-400">inactive</span>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={removingStream}
                      onClick={() => removeStream(s.id, s.name)}
                      className="ml-1 text-slate-400 hover:text-red-600"
                      aria-label={`Remove stream ${s.name}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && (
            <div className="mt-3 flex flex-col gap-2 sm:max-w-xs sm:flex-row">
              <Input
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                placeholder="e.g. A, B, East"
                maxLength={20}
                className="h-8 flex-1 text-[12px]"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={addingStream}
                disabled={!streamName.trim()}
                className="w-full sm:w-auto"
                onClick={addStream}
              >
                Add stream
              </Button>
            </div>
          )}
        </div>

        {hasTeachers && (
          <InlineAssignmentManager
            scope={{
              kind: "class",
              classId: row.id,
              level: row.level,
              streams: row.streams,
            }}
            isAdmin={isAdmin}
          />
        )}
      </CardBody>
    </Card>
  );
}

export function AcademicsClassesView() {
  const { toast } = useToast();
  const isAdmin = useAppSelector((s) => s.auth.user?.role === "school_admin");
  const { data: classes, isLoading, isError, refetch, isFetching } = useListClassesQuery();
  const [setupPrimary, { isLoading: settingUpPrimary }] = useSetupPrimaryClassesMutation();
  const [setupNursery, { isLoading: settingUpNursery }] = useSetupNurseryClassesMutation();
  const [createClass, { isLoading: creating }] = useCreateClassMutation();
  const [newLevel, setNewLevel] = useState<string>("BABY");

  const existingLevels = new Set((classes ?? []).map((c) => c.level));
  const missingLevels = ALL_CLASS_LEVELS.filter((l) => !existingLevels.has(l));
  const missingNursery = NURSERY_LEVELS.filter((l) => !existingLevels.has(l));
  const missingPrimary = PRIMARY_LEVELS.filter((l) => !existingLevels.has(l));

  async function addAllPrimary() {
    try {
      await setupPrimary().unwrap();
      toast("P1–P7 classes created.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addAllNursery() {
    try {
      await setupNursery().unwrap();
      toast("Baby–Top nursery classes created.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addOneClass() {
    try {
      await createClass({ level: newLevel }).unwrap();
      toast(`${newLevel} added.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load classes." />;

  const count = classes?.length ?? 0;
  const streamCount = (classes ?? []).reduce((sum, c) => sum + c.streams.length, 0);

  return (
    <div className="space-y-4 animate-fade-rise">
      {/* Toolbar */}
      <PageToolbar className="sm:justify-between">
        {count > 0 ? (
          <SettingsStatRow
            items={[
              { label: "Classes", value: count },
              { label: "Streams", value: streamCount },
            ]}
          />
        ) : (
          <span />
        )}
        <PageToolbarGroup>
          {isAdmin && count > 0 && (
            <>
              {missingLevels.length > 0 && (
                <>
                  <Select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full sm:w-24"
                    aria-label="Class level"
                  >
                    {missingLevels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" loading={creating} onClick={addOneClass}>
                    <Icon name="plus" size={13} />
                    Add class
                  </Button>
                </>
              )}
              {missingPrimary.length > 0 && (
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  loading={settingUpPrimary}
                  onClick={addAllPrimary}
                >
                  Add P1–P7
                </Button>
              )}
              {missingNursery.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  loading={settingUpNursery}
                  onClick={addAllNursery}
                >
                  Add {SECTION_LABELS.nursery}
                </Button>
              )}
            </>
          )}
          <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh classes" />
        </PageToolbarGroup>
      </PageToolbar>

      {count === 0 ? (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes configured"
          description={
            isAdmin
              ? "Add nursery (Baby–Top) and/or primary (P1–P7), then add streams where your school splits sections."
              : "Ask your school administrator to set up classes."
          }
          action={
            isAdmin ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="sm" loading={settingUpNursery} onClick={addAllNursery}>
                  <Icon name="plus" size={13} />
                  Add {SECTION_LABELS.nursery}
                </Button>
                <Button size="sm" variant="secondary" loading={settingUpPrimary} onClick={addAllPrimary}>
                  <Icon name="plus" size={13} />
                  Add P1–P7
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(classes ?? []).map((row) => (
            <ClassPanel key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
