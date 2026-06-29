"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { LEAVE_STATUS_LABEL } from "@/lib/hrPayrollMeta";
import type { PayslipOut } from "@/lib/types";
import {
  useListLeaveTypesQuery,
  useListMyLeaveRequestsQuery,
  useListMyPayslipsQuery,
  useRequestLeaveMutation,
} from "@/store/api/skulpulseApi";

function PayslipCard({ slip }: { slip: PayslipOut }) {
  const line = slip.line;
  return (
    <Card>
      <CardHeader
        title={slip.label}
        description={slip.finalized_at ? `Finalized ${new Date(slip.finalized_at).toLocaleDateString("en-UG")}` : ""}
      />
      <CardBody className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[10px] uppercase text-slate-400">Gross pay</p>
          <p className="text-lg font-semibold text-slate-900">{formatUGX(line.gross_ugx)}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-3">
          <p className="text-[10px] uppercase text-brand-700">Net pay</p>
          <p className="text-lg font-semibold text-brand-900">{formatUGX(line.net_ugx)}</p>
        </div>
        <p className="text-slate-600">NSSF (employee): {formatUGX(line.nssf_employee_ugx)}</p>
        <p className="text-slate-600">PAYE: {formatUGX(line.paye_ugx)}</p>
        {line.other_deductions_ugx > 0 ? (
          <p className="text-slate-600">Other deductions: {formatUGX(line.other_deductions_ugx)}</p>
        ) : null}
        {line.payment_method ? (
          <p className="capitalize text-slate-600">Paid via {line.payment_method.replace("_", " ")}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function HrPayrollMeView() {
  const { toast } = useToast();
  const { data: payslips = [], isLoading: payslipsLoading } = useListMyPayslipsQuery();
  const { data: myLeave = [], isLoading: leaveLoading } = useListMyLeaveRequestsQuery();
  const { data: leaveTypes = [] } = useListLeaveTypesQuery();
  const [requestLeave, { isLoading: submitting }] = useRequestLeaveMutation();
  const [form, setForm] = useState({
    leave_type_id: "",
    starts_on: "",
    ends_on: "",
    reason: "",
  });

  async function submitLeave() {
    if (!form.leave_type_id || !form.starts_on || !form.ends_on) {
      toast("Fill in leave type and dates.", "error");
      return;
    }
    try {
      await requestLeave({
        leave_type_id: form.leave_type_id,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        reason: form.reason || undefined,
      }).unwrap();
      toast("Leave request submitted.", "success");
      setForm({ leave_type_id: "", starts_on: "", ends_on: "", reason: "" });
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (payslipsLoading || leaveLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My HR"
        description="Request leave and view finalized payslips — task-focused, no admin clutter."
      />

      <section className="space-y-3">
        <h3 className="text-[12px] font-semibold text-slate-800">Request leave</h3>
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Leave type" required>
              <Select
                value={form.leave_type_id}
                onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}
              >
                <option value="">Select type</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="From" required>
              <Input type="date" value={form.starts_on} onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))} />
            </FormField>
            <FormField label="To" required>
              <Input type="date" value={form.ends_on} onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))} />
            </FormField>
            <FormField label="Reason">
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional" />
            </FormField>
          </CardBody>
          <div className="border-t border-slate-100 px-4 py-3">
            <Button size="sm" loading={submitting} onClick={() => void submitLeave()}>
              Submit request
            </Button>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-[12px] font-semibold text-slate-800">My leave history</h3>
        {myLeave.length === 0 ? (
          <EmptyState title="No leave requests" description="Submit a request above when you need time off." />
        ) : (
          <div className="space-y-2">
            {myLeave.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                <div>
                  <p className="text-[12px] font-medium text-slate-900">
                    {r.leave_type_label} · {r.starts_on} – {r.ends_on}
                  </p>
                  <p className="text-[11px] text-slate-500">{r.days} days</p>
                </div>
                <Badge tone={r.status === "approved" ? "green" : r.status === "pending" ? "amber" : "neutral"}>
                  {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[12px] font-semibold text-slate-800">My payslips</h3>
        {payslips.length === 0 ? (
          <EmptyState title="No payslips yet" description="Finalized payroll runs appear here each month." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {payslips.map((s) => (
              <PayslipCard key={`${s.run_id}-${s.line.id}`} slip={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
