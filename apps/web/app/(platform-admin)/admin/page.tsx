"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusBadge } from "@/components/ui/Badge";
import { SkeletonRows, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { parseError } from "@/lib/apiError";
import type { SchoolListItem } from "@/lib/types";
import { useListSchoolsQuery } from "@/store/api/skulpulseApi";

export default function SchoolsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<SchoolListItem[]>([]);

  const { data, isFetching, isError, error } = useListSchoolsQuery({
    status: status || undefined,
    cursor,
    limit: 20,
  });

  // Reset accumulation when the filter changes.
  useEffect(() => {
    setItems([]);
    setCursor(undefined);
  }, [status]);

  useEffect(() => {
    if (!data) return;
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.tenant_id));
      const fresh = data.items.filter((i) => !seen.has(i.tenant_id));
      return cursor ? [...prev, ...fresh] : data.items;
    });
  }, [data, cursor]);

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Schools"
        description="Onboard and manage primary schools on SkulPulse."
        action={
          <Link href="/admin/schools/new">
            <Button>Onboard school</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="max-w-[200px]"
        >
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {isError && <ErrorBanner message={parseError(error).message} />}

      {!isError && items.length === 0 && !isFetching ? (
        <EmptyState
          title="No schools yet"
          description="Onboard your first primary school to get started."
          action={
            <Link href="/admin/schools/new">
              <Button>Onboard school</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>School</TH>
                <TH>Code</TH>
                <TH>Status</TH>
                <TH>Ownership</TH>
                <TH>Modules</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s) => (
                <TR key={s.tenant_id} onClick={() => router.push(`/admin/schools/${s.tenant_id}`)}>
                  <TD className="font-medium text-slate-900">{s.name}</TD>
                  <TD><code className="text-xs">{s.school_code}</code></TD>
                  <TD><StatusBadge status={s.status} /></TD>
                  <TD className="capitalize">{s.ownership?.replace("_", " ") ?? "—"}</TD>
                  <TD>{s.module_count}</TD>
                </TR>
              ))}
              {isFetching && items.length === 0 && <SkeletonRows cols={5} />}
            </TBody>
          </Table>

          {data?.has_more && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                loading={isFetching}
                onClick={() => setCursor(data.next_cursor ?? undefined)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
