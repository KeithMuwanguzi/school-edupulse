export const HR_DEPARTMENTS = [
  { id: "teaching", label: "Teaching" },
  { id: "administration", label: "Administration" },
  { id: "support", label: "Support staff" },
  { id: "leadership", label: "Leadership" },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: "permanent", label: "Permanent" },
  { id: "contract", label: "Contract" },
  { id: "casual", label: "Casual" },
] as const;

export const PAYMENT_METHODS = [
  { id: "mobile_money", label: "Mobile money" },
  { id: "bank", label: "Bank transfer" },
  { id: "cash", label: "Cash" },
] as const;

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const HR_BEST_PRACTICES = [
  {
    title: "One staff record per person",
    body: "Portal accounts live in Settings → Users. HR adds job title, pay, TIN, and NSSF against that account — no duplicate spreadsheets.",
  },
  {
    title: "Payroll cutoff discipline",
    body: "Finalize monthly runs only after leave is approved and salary changes are saved. Finalized payslips are what staff see.",
  },
  {
    title: "Segment by role, not by channel",
    body: "Teachers request leave in the portal; admins approve in one queue. Avoid parallel WhatsApp approvals.",
  },
  {
    title: "Important vs routine",
    body: "Use draft → compute → review → finalize. NSSF and PAYE are estimated — verify with your accountant before statutory filing.",
  },
] as const;
