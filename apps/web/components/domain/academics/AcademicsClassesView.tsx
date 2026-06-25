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
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { ClassOut } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { InlineAssignmentManager } from "@/components/domain/teachers/InlineAssignmentManager";
import {
  useCreateClassMutation,
  useCreateStreamMutation,
  useDeleteClassMutation,
  useDeleteStreamMutation,
  useListClassesQuery,
  useSetupPrimaryClassesMutation,
  useUpdateClassMutation,
  useUpdateStreamMutation,
} from "@/store/api/skulpulseApi";

const LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"] as const;

function ClassPanel({ row }: { row: ClassOut }) {
  const { toast } = useToast();
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
    if (!window.confirm(`Remove ${row.level} and all its streams?`)) return;
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
    if (!window.confirm(`Remove stream ${name}?`)) return;
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
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
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
              <Button size="sm" variant="secondary" loading={saving} onClick={saveClass}>
                Save
              </Button>
              <Button size="sm" variant="ghost" loading={removing} onClick={removeClass}>
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
            <div className="mt-3 flex max-w-xs gap-2">
              <Input
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                placeholder="e.g. A, B, East"
                maxLength={20}
                className="h-8 text-[12px]"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={addingStream}
                disabled={!streamName.trim()}
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
  const [setupPrimary, { isLoading: settingUp }] = useSetupPrimaryClassesMutation();
  const [createClass, { isLoading: creating }] = useCreateClassMutation();
  const [newLevel, setNewLevel] = useState<string>("P1");

  const existingLevels = new Set((classes ?? []).map((c) => c.level));
  const missingLevels = LEVELS.filter((l) => !existingLevels.has(l));

  async function addAllPrimary() {
    try {
      await setupPrimary().unwrap();
      toast("P1–P7 classes created.", "success");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && count > 0 && (
            <>
              {missingLevels.length > 0 && (
                <>
                  <Select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-24"
                    aria-label="Class level"
                  >
                    {missingLevels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" loading={creating} onClick={addOneClass}>
                    <Icon name="plus" size={13} />
                    Add class
                  </Button>
                </>
              )}
              {count < 7 && (
                <Button size="sm" loading={settingUp} onClick={addAllPrimary}>
                  Add P1–P7
                </Button>
              )}
            </>
          )}
          <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh classes" />
        </div>
      </div>

      {count === 0 ? (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="No classes configured"
          description={
            isAdmin
              ? "Create all primary levels P1–P7 in one step, then add streams where your school splits sections."
              : "Ask your school administrator to set up classes."
          }
          action={
            isAdmin ? (
              <Button size="sm" loading={settingUp} onClick={addAllPrimary}>
                <Icon name="plus" size={13} />
                Add P1–P7
              </Button>
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
