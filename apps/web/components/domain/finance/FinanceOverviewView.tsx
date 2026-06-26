"use client";

import { useEffect, useMemo, useState } from "react";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { classOptionLabel } from "@/lib/schoolLevels";
import type { FeeInvoiceOut } from "@/lib/types";
import {
  useAcademicContextQuery,
  useFeeInvoiceDetailQuery,
  useFeeInvoicesQuery,
  useFinanceSummaryQuery,
  useGenerateFeeInvoicesMutation,
  useRecordFeePaymentMutation,
  useRegisteredRosterSummaryQuery,
} from "@/store/api/skulpulseApi";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "blue" | "neutral"> = {
  paid: "green",
  partial: "amber",
  unpaid: "red",
  waived: "blue",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mtn_momo", label: "MTN MoMo (manual)" },
  { value: "airtel_money", label: "Airtel Money (manual)" },
  { value: "other", label: "Other" },
];

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PaymentPanel({
  invoice,
  onClose,
}: {
  invoice: FeeInvoiceOut;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: detail, isLoading } = useFeeInvoiceDetailQuery(invoice.id);
  const [recordPayment, { isLoading: saving }] = useRecordFeePaymentMutation();
  const [amount, setAmount] = useState(String(invoice.balance_ugx));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) {
      toast("Enter a valid payment amount.", "error");
      return;
    }
    try {
      await recordPayment({
        invoiceId: invoice.id,
        body: {
          amount_ugx: parsed,
          method,
          reference: reference || undefined,
          note: note || undefined,
        },
      }).unwrap();
      toast("Payment recorded.", "success");
      onClose();
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Record payment — ${invoice.invoice_number}`}
        description={`${formatStudentFullName(invoice)} · Balance ${formatUGX(invoice.balance_ugx)}`}
        action={
          <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        }
      />
      <CardBody>
        {isLoading ? (
          <PageLoader />
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <FormField label="Amount (UGX)" htmlFor="pay-amount" required>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                max={invoice.balance_ugx}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Method" htmlFor="pay-method" required>
              <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Receipt / reference" htmlFor="pay-ref">
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Note" htmlFor="pay-note">
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
            {detail && detail.payments.length > 0 && (
              <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-600">
                <p className="mb-2 font-semibold text-slate-700">Previous payments</p>
                <ul className="space-y-1">
                  {detail.payments.map((p) => (
                    <li key={p.id}>
                      {formatUGX(p.amount_ugx)} via {p.method.replace(/_/g, " ")} on {p.paid_on}
                      {p.reference ? ` (${p.reference})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={saving || invoice.balance_ugx <= 0}>
                {saving ? "Saving…" : "Record payment"}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function classFilterLabel(level: string, label: string, count?: number) {
  const base = classOptionLabel(level, label);
  return count ? `${base} (${count})` : base;
}

export function FinanceOverviewView() {
  const { toast } = useToast();
  const { data: ctx } = useAcademicContextQuery();
  const termId = ctx?.active_term?.id;
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FeeInvoiceOut | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [classFilter, statusFilter]);

  useEffect(() => {
    if (selected) {
      document.getElementById("finance-payment-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  const { data: roster } = useRegisteredRosterSummaryQuery();
  const summaryArgs = useMemo(
    () =>
      termId
        ? { termId, ...(classFilter ? { classId: classFilter } : {}) }
        : classFilter
          ? { classId: classFilter }
          : undefined,
    [termId, classFilter],
  );
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErr,
  } = useFinanceSummaryQuery(summaryArgs);
  const {
    data: invoices,
    isLoading: invoicesLoading,
    isError: invoicesError,
    isFetching,
  } = useFeeInvoicesQuery(
    {
      termId,
      status: statusFilter || undefined,
      classId: classFilter || undefined,
      q: search.trim() || undefined,
    },
    { skip: !termId },
  );
  const [generate, { isLoading: generating }] = useGenerateFeeInvoicesMutation();

  const classOptions = useMemo(() => roster?.classes ?? [], [roster]);
  const selectedClass = classOptions.find((c) => c.class_id === classFilter);

  const canGenerate = useMemo(() => {
    if (!summary) return false;
    return Boolean(summary.active_structure_id) && summary.not_invoiced_count > 0;
  }, [summary]);

  const canRefreshUnpaid = useMemo(() => {
    if (!summary?.active_structure_id) return false;
    return (summary.counts?.unpaid ?? 0) > 0;
  }, [summary]);

  function formatGenerateResult(result: {
    created: number;
    refreshed: number;
    skipped_existing: number;
  }) {
    const parts: string[] = [];
    if (result.created) parts.push(`Created ${result.created} invoice(s)`);
    if (result.refreshed) parts.push(`Refreshed ${result.refreshed} unpaid invoice(s)`);
    if (result.skipped_existing) {
      parts.push(`${result.skipped_existing} left unchanged (already paid or partial)`);
    }
    return parts.length ? parts.join(". ") + "." : "No invoice changes were needed.";
  }

  async function handleGenerate(refreshUnpaid = false) {
    if ((summary?.registered_count ?? 0) === 0) {
      toast(
        "No term-registered pupils yet. Enroll and complete term check-in before generating invoices.",
        "warning",
      );
      return;
    }
    try {
      const result = await generate(
        termId ? { termId, refreshUnpaid } : { refreshUnpaid },
      ).unwrap();
      toast(formatGenerateResult(result), result.created || result.refreshed ? "success" : "info");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (summaryLoading) return <PageLoader />;
  if (summaryError) return <ErrorBanner message={parseError(summaryErr).message} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finance"
        title="Accounts & collections"
        description="Generate term invoices from the active fee structure and record manual payments. Live MoMo integration is not enabled yet."
        action={
          canGenerate || canRefreshUnpaid ? (
            <PageToolbar>
              {canGenerate && (
                <Button size="sm" className="w-full sm:w-auto" onClick={() => handleGenerate(false)} disabled={generating}>
                  {generating ? "Working…" : `Generate ${summary?.not_invoiced_count ?? 0} invoice(s)`}
                </Button>
              )}
              {canRefreshUnpaid && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                >
                  {generating ? "Working…" : "Refresh unpaid invoices"}
                </Button>
              )}
            </PageToolbar>
          ) : undefined
        }
      />

      {!summary?.active_structure_id && (
        <ErrorBanner
          compact
          message="No active fee structure for this term. A school admin must configure and activate one under Fee structures."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat
          label={classFilter ? "Registered (class)" : "Registered"}
          value={String(summary?.registered_count ?? 0)}
        />
        <SummaryStat label="Invoiced" value={formatUGX(summary?.total_invoiced_ugx ?? 0)} />
        <SummaryStat label="Collected" value={formatUGX(summary?.total_collected_ugx ?? 0)} />
        <SummaryStat label="Outstanding" value={formatUGX(summary?.total_outstanding_ugx ?? 0)} />
      </div>

      {summary?.expected_invoiced_ugx != null && summary.expected_invoiced_ugx !== summary.total_invoiced_ugx && (
        <p className="text-[12px] text-slate-600">
          Expected from active fee structure: {formatUGX(summary.expected_invoiced_ugx)}
          {classFilter ? " for this class" : " for registered learners"}.
          {summary.not_invoiced_count > 0
            ? ` ${summary.not_invoiced_count} learner(s) not yet invoiced.`
            : null}
        </p>
      )}

      <Card>
        <CardHeader
          title="Student invoices"
          description={
            summary
              ? classFilter && selectedClass
                ? `${invoices?.length ?? 0} invoice(s) for ${classOptionLabel(selectedClass.level, selectedClass.label)} · ${summary.term_label}`
                : `${summary.invoiced_count} of ${summary.registered_count} registered learners invoiced for ${summary.term_label}`
              : undefined
          }
        />
        <CardBody className="space-y-4">
          <PageToolbar className="sm:justify-start">
            <PageToolbarGroup className="w-full sm:flex-1">
              <FormField label="Class">
                <Select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full sm:w-44"
                >
                  <option value="">All classes</option>
                  {classOptions.map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {classFilterLabel(cls.level, cls.label, cls.count)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Status">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-40"
                >
                  <option value="">All statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </Select>
              </FormField>
              <FormField label="Search">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, number, invoice…"
                  className="w-full"
                />
              </FormField>
            </PageToolbarGroup>
          </PageToolbar>

          {invoicesLoading ? (
            <PageLoader />
          ) : invoicesError ? (
            <ErrorBanner message="Couldn't load invoices. Please refresh and try again." />
          ) : !invoices?.length ? (
            <EmptyState
              title={classFilter ? "No invoices for this class" : "No invoices yet"}
              description={
                classFilter
                  ? "Try another class or clear the class filter. Invoices appear after learners are registered and invoiced for this term."
                  : "Activate a fee structure, then generate invoices for registered students."
              }
            />
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {invoices.map((inv) => (
                  <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{formatStudentFullName(inv)}</p>
                        <p className="font-mono text-[10px] text-slate-400">{inv.student_number}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{inv.invoice_number}</p>
                      </div>
                      <Badge tone={inv.is_overdue ? "red" : STATUS_TONE[inv.status] ?? "neutral"} dot>
                        {inv.is_overdue ? "overdue" : inv.status}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <dt className="text-slate-400">Class</dt>
                      <dd className="text-right text-slate-700">{inv.class_label ?? "—"}</dd>
                      <dt className="text-slate-400">Total</dt>
                      <dd className="text-right font-medium text-slate-800">{formatUGX(inv.total_ugx)}</dd>
                      <dt className="text-slate-400">Balance</dt>
                      <dd className="text-right font-semibold text-slate-900">{formatUGX(inv.balance_ugx)}</dd>
                    </dl>
                    {inv.status !== "paid" && inv.status !== "waived" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3 w-full"
                        onClick={() => setSelected(inv)}
                      >
                        Record payment
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Student</TH>
                  <TH>Class</TH>
                  <TH>Total</TH>
                  <TH>Paid</TH>
                  <TH>Balance</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {invoices.map((inv) => (
                  <TR key={inv.id}>
                    <TD className="font-mono text-[12px]">{inv.invoice_number}</TD>
                    <TD>
                      <div className="font-medium text-slate-900">
                        {formatStudentFullName(inv)}
                      </div>
                      <div className="text-[11px] text-slate-500">{inv.student_number}</div>
                    </TD>
                    <TD>{inv.class_label ?? "—"}</TD>
                    <TD>{formatUGX(inv.total_ugx)}</TD>
                    <TD>{formatUGX(inv.amount_paid_ugx)}</TD>
                    <TD>{formatUGX(inv.balance_ugx)}</TD>
                    <TD>
                      <Badge tone={inv.is_overdue ? "red" : STATUS_TONE[inv.status] ?? "neutral"} dot>
                        {inv.is_overdue ? "overdue" : inv.status}
                      </Badge>
                    </TD>
                    <TD>
                      {inv.status !== "paid" && inv.status !== "waived" && (
                        <Button size="sm" variant="secondary" onClick={() => setSelected(inv)}>
                          Record
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
              </div>
            </>
          )}
          {isFetching && !invoicesLoading && (
            <p className="text-[11px] text-slate-400">Refreshing…</p>
          )}
        </CardBody>
      </Card>

      {selected && (
        <div id="finance-payment-panel">
          <PaymentPanel invoice={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
