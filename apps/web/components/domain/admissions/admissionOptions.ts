export const WITHDRAWAL_REASON_OPTIONS = [
  { value: "rejected", label: "Rejected" },
  { value: "withdrew", label: "Withdrew" },
  { value: "no_show", label: "No show" },
  { value: "other", label: "Other" },
] as const;

export type WithdrawalReason = (typeof WITHDRAWAL_REASON_OPTIONS)[number]["value"];

export function withdrawalReasonLabel(reason?: string | null): string {
  return WITHDRAWAL_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? reason ?? "—";
}

export const ADMISSION_PIPELINE_STATUSES = [
  { key: "application", label: "Applications" },
  { key: "interview", label: "Interview" },
  { key: "accepted", label: "Accepted" },
  { key: "enrolled", label: "Enrolled" },
] as const;

export const ADMISSION_NEXT_STATUS: Record<string, string | null> = {
  application: "interview",
  interview: "accepted",
  accepted: null,
  enrolled: null,
  withdrawn: null,
};

export function admissionStatusLabel(status: string): string {
  return ADMISSION_PIPELINE_STATUSES.find((s) => s.key === status)?.label ?? status;
}

export function formatAppliedClass(
  level?: string | null,
  classLabel?: string | null,
  streamName?: string | null,
): string {
  if (classLabel) {
    return streamName ? `${classLabel} · ${streamName}` : classLabel;
  }
  if (level) return level;
  return "—";
}
