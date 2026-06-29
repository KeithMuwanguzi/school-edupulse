"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import {
  useComputePayrollRunMutation,
  useCreatePayrollRunMutation,
  useFinalizePayrollRunMutation,
  useGetPayrollRunQuery,
  useListPayrollRunsQuery,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { HR_PAYROLL_ADMIN_ROLES, roleHasAny } from "@/lib/roleAccess";

export function HrPayrollPayrollView() {
  const { toast } = useToast();
  const user = useAppSelector((s) => s.auth.user);
  const canManage = roleHasAny(user?.role, ...HR_PAYROLL_ADMIN_ROLES);
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs = [], isLoading, isError } = useListPayrollRunsQuery();
  const { data: runDetail, isFetching } = useGetPayrollRunQuery(selectedRunId!, {
    skip: !selectedRunId,
  });
  const [createRun, { isLoading: creating }] = useCreatePayrollRunMutation();
  const [computeRun, { isLoading: computing }] = useComputePayrollRunMutation();
  const [finalizeRun, { isLoading: finalizing }] = useFinalizePayrollRunMutation();

  async function handleCreate() {
    try {
      const out = await createRun({
        year: Number(year),
        month: Number(month),
      }).unwrap();
      toast("Payroll run created and computed.", "success");
      setSelectedRunId(out.id);
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleCompute() {
    if (!selectedRunId) return;
    try {
      await computeRun(selectedRunId).unwrap();
      toast("Payroll recomputed from current salary profiles.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleFinalize() {
    if (!selectedRunId) return;
    try {
      await finalizeRun(selectedRunId).unwrap();
      toast("Payroll finalized. Staff can view payslips.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load payroll runs." />;

  const detail = runDetail ?? runs.find((r) => r.id === selectedRunId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monthly payroll"
        description="Draft → compute → review → finalize. NSSF (5%) and PAYE use simplified Uganda bands — confirm with your accountant."
      />

      {canManage ? (
        <Card>
          <CardHeader title="New pay run" />
          <CardBody className="flex flex-wrap items-end gap-3">
            <FormField label="Year">
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
            </FormField>
            <FormField label="Month">
              <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className="w-20" />
            </FormField>
            <Button size="sm" loading={creating} onClick={() => void handleCreate()}>
              Create & compute
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {runs.length === 0 ? (
            <EmptyState title="No pay runs yet" description="Create a monthly run to get started." />
          ) : (
            runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRunId(r.id)}
                className={`w-full rounded-xl border p-3 text-left shadow-card transition ${
                  selectedRunId === r.id
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{r.label}</span>
                  <Badge tone={r.status === "finalized" ? "green" : "blue"}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {r.staff_count} staff · Net {formatUGX(r.total_net_ugx)}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!detail ? (
            <EmptyState title="Select a pay run" description="Choose a month from the list to review lines." />
          ) : isFetching ? (
            <PageLoader />
          ) : (
            <Card>
              <CardHeader
                title={detail.label}
                description={`Gross ${formatUGX(detail.total_gross_ugx)} · Deductions ${formatUGX(detail.total_deductions_ugx)} · Net ${formatUGX(detail.total_net_ugx)}`}
                action={
                  canManage && detail.status === "draft" ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" loading={computing} onClick={() => void handleCompute()}>
                        Recompute
                      </Button>
                      <Button size="sm" loading={finalizing} onClick={() => void handleFinalize()}>
                        Finalize
                      </Button>
                    </div>
                  ) : undefined
                }
              />
              <CardBody className="overflow-x-auto">
                {(detail.lines ?? []).length === 0 ? (
                  <p className="text-[12px] text-slate-500">No lines — ensure employees have salary profiles.</p>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Employee</TH>
                        <TH>Gross</TH>
                        <TH>NSSF</TH>
                        <TH>PAYE</TH>
                        <TH>Other</TH>
                        <TH>Net</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {(detail.lines ?? []).map((line) => (
                        <TR key={line.id}>
                          <TD>
                            <span className="font-medium">{line.employee_name}</span>
                            <span className="block text-[10px] text-slate-400">{line.job_title ?? line.login_id}</span>
                          </TD>
                          <TD>{formatUGX(line.gross_ugx)}</TD>
                          <TD>{formatUGX(line.nssf_employee_ugx)}</TD>
                          <TD>{formatUGX(line.paye_ugx)}</TD>
                          <TD>{formatUGX(line.other_deductions_ugx)}</TD>
                          <TD className="font-semibold">{formatUGX(line.net_ugx)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
