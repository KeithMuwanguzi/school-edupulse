"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { PAGE_SIZE, TablePagination } from "@/components/ui/TablePagination";
import { cn } from "@/lib/cn";
import { useErrorLogsQuery, useRequestLogsQuery } from "@/store/api/skulpulseApi";

function statusTone(code: number) {
  if (code >= 500) return "red";
  if (code >= 400) return "amber";
  return "green";
}

/** Cursor stack: cursors[pageIndex] is the `before` param for that page (undefined = newest). */
function useLogPagination(tab: "requests" | "errors") {
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
  const [tab, setTab] = useState<"requests" | "errors">("requests");
  const { page, before, goNext, goPrevious } = useLogPagination(tab);

  const { data: requests, isFetching: rFetching } = useRequestLogsQuery(
    { limit: PAGE_SIZE, before },
    { skip: tab !== "requests" },
  );
  const { data: errors, isFetching: eFetching } = useErrorLogsQuery(
    { limit: PAGE_SIZE, before },
    { skip: tab !== "errors" },
  );

  const requestRows = requests ?? [];
  const errorRows = errors ?? [];
  const hasNextRequests = requestRows.length === PAGE_SIZE;
  const hasNextErrors = errorRows.length === PAGE_SIZE;

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Logs"
        description="Request trail and error log across all tenants."
      />

      <div className="mb-4 inline-flex rounded-md border border-slate-200 bg-white p-0.5">
        {(["requests", "errors"] as const).map((t) => (
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
            {t}
          </button>
        ))}
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
      ) : (
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
      )}
    </div>
  );
}
