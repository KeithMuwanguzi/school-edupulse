"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import {
  EMPLOYMENT_TYPES,
  HR_DEPARTMENTS,
  PAYMENT_METHODS,
} from "@/lib/hrPayrollMeta";
import type { EmployeeOut } from "@/lib/types";
import {
  useListHrEmployeesQuery,
  useUpsertEmployeeProfileMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { HR_PAYROLL_ADMIN_ROLES, roleHasAny } from "@/lib/roleAccess";

function EmployeeEditor({
  employee,
  onClose,
}: {
  employee: EmployeeOut;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [save, { isLoading }] = useUpsertEmployeeProfileMutation();
  const [form, setForm] = useState({
    job_title: employee.job_title ?? "",
    department: employee.department ?? "teaching",
    employment_type: employee.employment_type ?? "permanent",
    hire_date: employee.hire_date ?? "",
    tin: employee.tin ?? "",
    nssf_number: employee.nssf_number ?? "",
    payment_method: employee.payment_method ?? "mobile_money",
    bank_name: employee.bank_name ?? "",
    bank_account: employee.bank_account ?? "",
    mobile_money_number: employee.mobile_money_number ?? "",
    base_salary_ugx: String(employee.base_salary_ugx ?? 0),
    housing_allowance_ugx: String(employee.housing_allowance_ugx ?? 0),
    transport_allowance_ugx: String(employee.transport_allowance_ugx ?? 0),
    responsibility_allowance_ugx: String(employee.responsibility_allowance_ugx ?? 0),
    other_allowances_ugx: String(employee.other_allowances_ugx ?? 0),
    recurring_deduction_ugx: String(employee.recurring_deduction_ugx ?? 0),
    recurring_deduction_note: employee.recurring_deduction_note ?? "",
    annual_leave_days: String(employee.annual_leave_days ?? 21),
    is_active: employee.is_active !== false,
  });

  async function submit() {
    try {
      await save({
        userId: employee.user_id,
        body: {
          ...form,
          base_salary_ugx: Number(form.base_salary_ugx) || 0,
          housing_allowance_ugx: Number(form.housing_allowance_ugx) || 0,
          transport_allowance_ugx: Number(form.transport_allowance_ugx) || 0,
          responsibility_allowance_ugx: Number(form.responsibility_allowance_ugx) || 0,
          other_allowances_ugx: Number(form.other_allowances_ugx) || 0,
          recurring_deduction_ugx: Number(form.recurring_deduction_ugx) || 0,
          annual_leave_days: Number(form.annual_leave_days) || 21,
          hire_date: form.hire_date || null,
        },
      }).unwrap();
      toast("Employee profile saved.", "success");
      onClose();
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title={employee.name}
        description={`${employee.role_label} · ${employee.login_id}`}
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />
      <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Job title">
          <Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
        </FormField>
        <FormField label="Department">
          <Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
            {HR_DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Employment type">
          <Select value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Hire date">
          <Input type="date" value={form.hire_date} onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} />
        </FormField>
        <FormField label="TIN">
          <Input value={form.tin} onChange={(e) => setForm((f) => ({ ...f, tin: e.target.value }))} />
        </FormField>
        <FormField label="NSSF number">
          <Input value={form.nssf_number} onChange={(e) => setForm((f) => ({ ...f, nssf_number: e.target.value }))} />
        </FormField>
        <FormField label="Payment method">
          <Select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Mobile money number">
          <Input value={form.mobile_money_number} onChange={(e) => setForm((f) => ({ ...f, mobile_money_number: e.target.value }))} />
        </FormField>
        <FormField label="Bank name">
          <Input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
        </FormField>
        <FormField label="Bank account">
          <Input value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} />
        </FormField>
        <FormField label="Base salary (UGX)">
          <Input type="number" min={0} value={form.base_salary_ugx} onChange={(e) => setForm((f) => ({ ...f, base_salary_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Housing allowance">
          <Input type="number" min={0} value={form.housing_allowance_ugx} onChange={(e) => setForm((f) => ({ ...f, housing_allowance_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Transport allowance">
          <Input type="number" min={0} value={form.transport_allowance_ugx} onChange={(e) => setForm((f) => ({ ...f, transport_allowance_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Responsibility allowance">
          <Input type="number" min={0} value={form.responsibility_allowance_ugx} onChange={(e) => setForm((f) => ({ ...f, responsibility_allowance_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Other allowances">
          <Input type="number" min={0} value={form.other_allowances_ugx} onChange={(e) => setForm((f) => ({ ...f, other_allowances_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Recurring deduction">
          <Input type="number" min={0} value={form.recurring_deduction_ugx} onChange={(e) => setForm((f) => ({ ...f, recurring_deduction_ugx: e.target.value }))} />
        </FormField>
        <FormField label="Deduction note">
          <Input value={form.recurring_deduction_note} onChange={(e) => setForm((f) => ({ ...f, recurring_deduction_note: e.target.value }))} placeholder="Loan, advance…" />
        </FormField>
        <FormField label="Annual leave days">
          <Input type="number" min={0} max={60} value={form.annual_leave_days} onChange={(e) => setForm((f) => ({ ...f, annual_leave_days: e.target.value }))} />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
          <Button size="sm" loading={isLoading} onClick={() => void submit()}>
            Save profile
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function HrPayrollEmployeesView() {
  const user = useAppSelector((s) => s.auth.user);
  const canEdit = roleHasAny(user?.role, ...HR_PAYROLL_ADMIN_ROLES);
  const { data: employees = [], isLoading, isError } = useListHrEmployeesQuery();
  const [selected, setSelected] = useState<EmployeeOut | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.login_id.includes(needle) ||
        (e.job_title ?? "").toLowerCase().includes(needle),
    );
  }, [employees, q]);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load employees." />;

  if (selected) {
    return <EmployeeEditor employee={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employee records"
        description="Link portal accounts to job details and salary packages. Create accounts under Settings → Users first."
      />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, ID, or job title"
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <EmptyState title="No staff found" description="Add staff portal accounts under Settings → Users." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Job / dept</TH>
                <TH>Gross</TH>
                <TH>Profile</TH>
                {canEdit ? <TH /> : null}
              </TR>
            </THead>
            <TBody>
              {filtered.map((e) => (
                <TR key={e.user_id}>
                  <TD>
                    <span className="font-medium text-slate-900">{e.name}</span>
                    <span className="block text-[10px] text-slate-400">{e.login_id}</span>
                  </TD>
                  <TD>{e.role_label}</TD>
                  <TD>
                    {e.job_title ?? "—"}
                    {e.department ? (
                      <span className="block text-[10px] capitalize text-slate-400">{e.department}</span>
                    ) : null}
                  </TD>
                  <TD>{e.gross_salary_ugx ? formatUGX(e.gross_salary_ugx) : "—"}</TD>
                  <TD>
                    <Badge tone={e.has_profile ? "green" : "amber"}>
                      {e.has_profile ? "Complete" : "Incomplete"}
                    </Badge>
                  </TD>
                  {canEdit ? (
                    <TD>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(e)}>
                        {e.has_profile ? "Edit" : "Set up"}
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
