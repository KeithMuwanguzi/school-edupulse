"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AdmissionApplicationOut } from "@/lib/types";
import { WITHDRAWAL_REASON_OPTIONS } from "./admissionOptions";

const compactControl = "h-7 text-[12px]";

interface WithdrawApplicationPanelProps {
  application: AdmissionApplicationOut;
  loading: boolean;
  onConfirm: (payload: {
    withdrawal_reason: string;
    withdrawal_note?: string;
  }) => void;
  onCancel: () => void;
}

export function WithdrawApplicationPanel({
  application,
  loading,
  onConfirm,
  onCancel,
}: WithdrawApplicationPanelProps) {
  const [reason, setReason] = useState("rejected");
  const [note, setNote] = useState("");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-[11px] font-medium text-slate-800">
        Close application — {application.first_name} {application.last_name}
        <span className="ml-1.5 font-mono font-normal text-slate-400">
          {application.reference_number}
        </span>
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        The applicant leaves the active pipeline and moves to the archive. You can reopen later if
        needed.
      </p>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Reason" required>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={compactControl}
          >
            {WITHDRAWAL_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        {reason === "other" && (
          <div className="sm:col-span-2">
            <FormField label="Note" required>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief explanation"
                className={compactControl}
              />
            </FormField>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          className="w-full sm:w-auto"
          onClick={() =>
            onConfirm({
              withdrawal_reason: reason,
              withdrawal_note: reason === "other" ? note.trim() : note.trim() || undefined,
            })
          }
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
