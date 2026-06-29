"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import { LEAVE_STATUS_LABEL } from "@/lib/hrPayrollMeta";
import {
  useApproveLeaveMutation,
  useListLeaveRequestsQuery,
  useRejectLeaveMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { HR_PAYROLL_ADMIN_ROLES, roleHasAny } from "@/lib/roleAccess";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "neutral",
};

export function HrPayrollLeaveView() {
  const { toast } = useToast();
  const user = useAppSelector((s) => s.auth.user);
  const canReview = roleHasAny(user?.role, ...HR_PAYROLL_ADMIN_ROLES);
  const [filter, setFilter] = useState<string>("pending");
  const { data: requests = [], isLoading, isError } = useListLeaveRequestsQuery(
    filter ? { status: filter } : undefined,
  );
  const [approve, { isLoading: approving }] = useApproveLeaveMutation();
  const [reject, { isLoading: rejecting }] = useRejectLeaveMutation();

  async function handleApprove(id: string) {
    try {
      await approve({ requestId: id }).unwrap();
      toast("Leave approved.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleReject(id: string) {
    try {
      await reject({ requestId: id }).unwrap();
      toast("Leave rejected.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorBanner message="Unable to load leave requests." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave management"
        description="Staff submit requests under My HR. Approve or reject here before payroll cutoff."
      />
      <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </Select>

      {requests.length === 0 ? (
        <EmptyState title="No leave requests" description="Nothing matches this filter." />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">{r.employee_name}</span>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-600">
                    {r.leave_type_label} · {r.starts_on} – {r.ends_on} ({r.days} days)
                  </p>
                  {r.reason ? <p className="mt-1 text-[11px] text-slate-500">{r.reason}</p> : null}
                </div>
                {canReview && r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" loading={approving} onClick={() => void handleApprove(r.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" loading={rejecting} onClick={() => void handleReject(r.id)}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
