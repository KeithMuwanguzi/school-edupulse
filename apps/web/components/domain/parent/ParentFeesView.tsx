"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  useGetParentFeeInvoiceQuery,
  useGetParentOverviewQuery,
  useListParentFeesQuery,
} from "@/store/api/skulpulseApi";

function formatUgx(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

function statusTone(
  status: string,
  isOverdue: boolean,
): "green" | "gold" | "neutral" | "red" {
  if (status === "paid" || status === "waived") return "green";
  if (isOverdue) return "red";
  if (status === "partial") return "gold";
  return "neutral";
}

function FeeDetailPanel({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, isError } = useGetParentFeeInvoiceQuery(invoiceId);

  if (isLoading) return <p className="text-[11px] text-slate-500">Loading invoice…</p>;
  if (isError || !data) {
    return <ErrorBanner message="Unable to load invoice details." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Total
          </p>
          <p className="mt-1 font-display text-lg font-medium text-slate-900">
            {formatUgx(data.total_ugx)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Paid
          </p>
          <p className="mt-1 font-display text-lg font-medium text-slate-900">
            {formatUgx(data.amount_paid_ugx)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Balance
          </p>
          <p className="mt-1 font-display text-lg font-medium text-slate-900">
            {formatUgx(data.balance_ugx)}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Fee breakdown
        </h3>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/80">
          {data.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-[11.5px]"
            >
              <span className="text-slate-700">{line.label}</span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatUgx(line.amount_ugx)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.payments.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Payments recorded
          </h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/80">
            {data.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-[11.5px]"
              >
                <span className="text-slate-700">
                  {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {formatUgx(payment.amount_ugx)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No payments recorded yet. Pay at the school bursar&apos;s office or through channels
          announced by the school.
        </p>
      )}
    </div>
  );
}

export function ParentFeesView() {
  const { data: overview } = useGetParentOverviewQuery();
  const { data: invoices = [], isLoading, isError } = useListParentFeesQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const childName =
    overview?.child.preferred_name?.trim() ||
    (overview?.child
      ? `${overview.child.first_name} ${overview.child.last_name}`.trim()
      : "Your child");

  if (isLoading) return <PageLoader />;

  const active = selectedId ?? invoices[0]?.id ?? null;

  return (
    <div className="space-y-4 animate-fade-rise">
      <PageHeader
        eyebrow="Fees"
        title={childName}
        description="Term invoices and payment history for this learner. All guardians share this view."
      />

      {isError ? (
        <ErrorBanner message="Unable to load fee records." />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Icon name="wallet" size={18} />}
          title="No invoices yet"
          description="The bursar has not issued a fee invoice for this learner yet."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader title="Invoices" description="Select a term to view details" />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(inv.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition",
                        active === inv.id ? "bg-brand-50/70" : "hover:bg-slate-50",
                      )}
                    >
                      <span>
                        <span className="block text-[11.5px] font-medium text-slate-900">
                          {inv.term_label}
                        </span>
                        <span className="block text-[10.5px] text-slate-500">
                          {inv.invoice_number}
                        </span>
                      </span>
                      <span className="text-right">
                        <Badge tone={statusTone(inv.status, inv.is_overdue)}>
                          {inv.is_overdue ? "Overdue" : inv.status}
                        </Badge>
                        <span className="mt-1 block text-[11px] font-medium tabular-nums text-slate-800">
                          {inv.balance_ugx === 0 ? "Clear" : formatUgx(inv.balance_ugx)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader
              title="Invoice detail"
              description="Read-only — contact the bursar to make a payment"
            />
            <CardBody>{active ? <FeeDetailPanel invoiceId={active} /> : null}</CardBody>
          </Card>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Need help?{" "}
        <Link href="/app/circulars" className="font-medium text-brand-600 hover:text-brand-700">
          Check school circulars
        </Link>{" "}
        for payment instructions.
      </p>
    </div>
  );
}
