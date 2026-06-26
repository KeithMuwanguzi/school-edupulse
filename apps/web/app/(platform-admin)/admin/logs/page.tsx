"use client";

import { useEffect, useState } from "react";
import {
  downloadAuditExport,
  downloadAuditFile,
} from "@/lib/platformAuditDownload";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { PAGE_SIZE, TablePagination } from "@/components/ui/TablePagination";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import {
  useAuditLogFilesQuery,
  useAuditLogsQuery,
  useErrorLogsQuery,
  useRequestLogsQuery,
} from "@/store/api/skulpulseApi";

function statusTone(code: number) {
  if (code >= 500) return "red";
  if (code >= 400) return "amber";
  return "green";
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Cursor stack: cursors[pageIndex] is the `before` param for that page (undefined = newest). */
function useLogPagination(tab: string) {
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);

  useEffect(() => {
    setPage(1);
    setCursors([undefined]);
  }, [tab]);

  const before = cursors[page - 1];

  function goNext(lastCreatedAt: string) {
    setPage((p) => p + 1);
    setCursors((prev) => {
      const next = [...prev];
      next[page] = lastCreatedAt;
      return next;
    });
  }

  function goPrevious() {
    setPage((p) => Math.max(1, p - 1));
  }

  return { page, before, goNext, goPrevious };
}

export default function LogsPage() {
  const { toast } = useToast();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const [tab, setTab] = useState<"requests" | "errors" | "audit" | "files">("requests");
  const { page, before, goNext, goPrevious } = useLogPagination(tab);
  const [exporting, setExporting] = useState(false);

  const { data: requests, isFetching: rFetching } = useRequestLogsQuery(
    { limit: PAGE_SIZE, before },
    { skip: tab !== "requests" },
  );
  const { data: errors, isFetching: eFetching } = useErrorLogsQuery(
    { limit: PAGE_SIZE, before },
    { skip: tab !== "errors" },
  );
  const { data: auditRows, isFetching: aFetching } = useAuditLogsQuery(
    { limit: PAGE_SIZE, before, actor_type: tab === "audit" ? undefined : undefined },
    { skip: tab !== "audit" },
  );
  const { data: files = [], isFetching: fFetching } = useAuditLogFilesQuery(undefined, {
    skip: tab !== "files",
  });

  const requestRows = requests ?? [];
  const errorRows = errors ?? [];
  const audit = auditRows ?? [];
  const hasNextRequests = requestRows.length === PAGE_SIZE;
  const hasNextErrors = errorRows.length === PAGE_SIZE;
  const hasNextAudit = audit.length === PAGE_SIZE;

  async function exportAudit(format: "csv" | "json") {
    setExporting(true);
    try {
      await downloadAuditExport(format, accessToken);
      toast(`Audit trail exported as ${format.toUpperCase()}.`, "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    } finally {
      setExporting(false);
    }
  }

  async function onDownloadFile(path: string) {
    try {
      await downloadAuditFile(path, accessToken);
      toast("Audit file downloaded.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Logs"
        description="Request trail, errors, audit events, and downloadable JSONL audit files."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
          {(["requests", "errors", "audit", "files"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-3 py-1 text-[11px] font-semibold capitalize tracking-wide transition",
                tab === t
                  ? "bg-slate-100 text-brand-700"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t === "files" ? "Audit files" : t}
            </button>
          ))}
        </div>
        {tab === "audit" && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" loading={exporting} onClick={() => void exportAudit("csv")}>
              Export CSV
            </Button>
            <Button size="sm" variant="secondary" loading={exporting} onClick={() => void exportAudit("json")}>
              Export JSON
            </Button>
          </div>
        )}
      </div>

      {tab === "requests" ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Method</TH>
                <TH>Path</TH>
                <TH>Status</TH>
                <TH>ms</TH>
                <TH>Request ID</TH>
              </TR>
            </THead>
            <TBody>
              {rFetching && requestRows.length === 0 && <SkeletonRows cols={6} />}
              {requestRows.map((r) => (
                <TR key={r.request_id + r.created_at}>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-xs font-medium">{r.method}</TD>
                  <TD className="max-w-[260px] truncate text-xs">{r.path}</TD>
                  <TD>
                    <Badge tone={statusTone(r.status_code)}>{r.status_code}</Badge>
                  </TD>
                  <TD className="text-xs">{r.duration_ms}</TD>
                  <TD>
                    <code className="text-xs text-slate-500">{r.request_id.slice(0, 8)}</code>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {!rFetching && requestRows.length === 0 && (
            <div className="mt-4">
              <EmptyState title="No request logs" description="API traffic will appear here." />
            </div>
          )}

          {requestRows.length > 0 && (
            <TablePagination
              page={page}
              count={requestRows.length}
              hasNext={hasNextRequests}
              loading={rFetching}
              onPrevious={goPrevious}
              onNext={() => {
                const last = requestRows[requestRows.length - 1];
                if (last) goNext(last.created_at);
              }}
            />
          )}
        </>
      ) : tab === "errors" ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Type</TH>
                <TH>Message</TH>
                <TH>Endpoint</TH>
                <TH>Request ID</TH>
              </TR>
            </THead>
            <TBody>
              {eFetching && errorRows.length === 0 && <SkeletonRows cols={5} />}
              {errorRows.map((e) => (
                <TR key={e.request_id + e.created_at}>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-xs font-medium text-red-700">{e.error_type ?? e.level}</TD>
                  <TD className="max-w-[280px] truncate text-xs">{e.message}</TD>
                  <TD className="max-w-[200px] truncate text-xs">{e.endpoint}</TD>
                  <TD>
                    <code className="text-xs text-slate-500">{e.request_id.slice(0, 8)}</code>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {!eFetching && errorRows.length === 0 && (
            <div className="mt-4">
              <EmptyState title="No errors logged" description="Nothing to investigate right now." />
            </div>
          )}

          {errorRows.length > 0 && (
            <TablePagination
              page={page}
              count={errorRows.length}
              hasNext={hasNextErrors}
              loading={eFetching}
              onPrevious={goPrevious}
              onNext={() => {
                const last = errorRows[errorRows.length - 1];
                if (last) goNext(last.created_at);
              }}
            />
          )}
        </>
      ) : tab === "audit" ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Resource</TH>
                <TH>Request ID</TH>
              </TR>
            </THead>
            <TBody>
              {aFetching && audit.length === 0 && <SkeletonRows cols={5} />}
              {audit.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-xs font-medium text-slate-800">{row.action}</TD>
                  <TD className="text-xs text-slate-600">
                    {row.actor_type}
                    {row.actor_id ? (
                      <span className="ml-1 font-mono text-[10px] text-slate-400">
                        {row.actor_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="max-w-[180px] truncate text-xs text-slate-500">
                    {row.resource_type ?? "—"}
                  </TD>
                  <TD>
                    <code className="text-xs text-slate-500">
                      {row.request_id?.slice(0, 8) ?? "—"}
                    </code>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {!aFetching && audit.length === 0 && (
            <div className="mt-4">
              <EmptyState title="No audit events" description="Business actions will appear here." />
            </div>
          )}

          {audit.length > 0 && (
            <TablePagination
              page={page}
              count={audit.length}
              hasNext={hasNextAudit}
              loading={aFetching}
              onPrevious={goPrevious}
              onNext={() => {
                const last = audit[audit.length - 1];
                if (last) goNext(last.created_at);
              }}
            />
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-[12px] text-slate-500">
            Structured JSONL audit files (Serilog-style). Global monthly logs and per-admin trails.
          </p>
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>File</TH>
                <TH>Size</TH>
                <TH>Updated</TH>
                <TH className="text-right">Download</TH>
              </TR>
            </THead>
            <TBody>
              {fFetching && files.length === 0 && <SkeletonRows cols={5} />}
              {files.map((file) => (
                <TR key={file.relative_path}>
                  <TD className="text-xs capitalize text-slate-600">{file.kind}</TD>
                  <TD className="font-mono text-[11px] text-slate-700">{file.relative_path}</TD>
                  <TD className="text-xs text-slate-500">{formatBytes(file.size_bytes)}</TD>
                  <TD className="text-xs text-slate-500">
                    {new Date(file.modified_at).toLocaleString()}
                  </TD>
                  <TD className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onDownloadFile(file.relative_path)}
                    >
                      Download
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {!fFetching && files.length === 0 && (
            <div className="mt-4">
              <EmptyState
                title="No audit files yet"
                description="Files are created when platform actions are recorded."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
