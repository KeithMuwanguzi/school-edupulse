import type { ToastTone } from "@/components/ui/Toast";
import type {
  AdmissionBatchResponse,
  ImportUsersResponse,
  StudentImportResponse,
  TimetableImportResponse,
} from "@/lib/types";

type ToastFn = (message: string, tone?: ToastTone, requestId?: string) => void;

export function toastStudentImportValidate(
  toast: ToastFn,
  res: StudentImportResponse,
): boolean {
  if (res.failed > 0) {
    const classHint = res.results.some((r) => r.message?.includes("not found"))
      ? " Check classes and streams under Academics."
      : "";
    toast(`${res.failed} row(s) failed validation.${classHint}`, "error");
    return false;
  }
  if (res.valid === 0) {
    toast("No rows are ready to import.", "error");
    return false;
  }
  toast(`${res.valid} row(s) passed validation — review, then confirm import.`, "success");
  return true;
}

export function toastStudentImportCommit(toast: ToastFn, res: StudentImportResponse): void {
  if (res.failed > 0) {
    toast(`${res.failed} row(s) failed during import.`, "error");
    return;
  }
  if (res.created === 0 && res.skipped > 0) {
    toast(`All ${res.skipped} row(s) were already enrolled — nothing new was added.`, "info");
    return;
  }
  if (res.created > 0 && res.skipped > 0) {
    toast(`Enrolled ${res.created} pupil(s). ${res.skipped} duplicate(s) skipped.`, "success");
    return;
  }
  if (res.created > 0) {
    toast(`${res.created} pupil(s) enrolled successfully.`, "success");
    return;
  }
  toast("Import completed with no new enrollments.", "info");
}

export function toastTimetableImport(
  toast: ToastFn,
  res: TimetableImportResponse,
  phase: "validate" | "commit",
): void {
  if (res.failed > 0) {
    const setupHint = res.results.some(
      (r) =>
        r.message?.includes("not found") ||
        r.message?.includes("Subject") ||
        r.message?.includes("teacher"),
    );
    const suffix = setupHint
      ? " Set up classes, subjects, and staff first, then re-upload."
      : "";
    toast(
      phase === "validate"
        ? `${res.failed} row(s) failed validation.${suffix}`
        : `${res.failed} row(s) could not be imported.${suffix}`,
      "error",
    );
    return;
  }
  if (phase === "validate") {
    toast(`${res.valid} lesson(s) ready to import.`, "success");
    return;
  }
  toast(`${res.created} lesson(s) added to the timetable.`, "success");
}

export function toastStaffImport(toast: ToastFn, res: ImportUsersResponse): void {
  if (res.failed > 0) {
    toast(`${res.created} created · ${res.failed} failed. Check the result list.`, "error");
    return;
  }
  if (res.created === 0 && res.skipped > 0) {
    toast(`All ${res.skipped} row(s) skipped — login IDs already exist.`, "info");
    return;
  }
  if (res.created > 0 && res.skipped > 0) {
    toast(`${res.created} account(s) created. ${res.skipped} duplicate(s) skipped.`, "success");
    return;
  }
  toast(`${res.created} staff account(s) created. Copy any generated passwords now.`, "success");
}

export function toastGuardianImport(toast: ToastFn, res: ImportUsersResponse): void {
  if (res.failed > 0) {
    const missing = res.results.some((r) => r.message?.includes("not enrolled"));
    toast(
      `${res.failed} row(s) failed.${missing ? " Enroll pupils before linking guardians." : ""}`,
      "error",
    );
    return;
  }
  if (res.created === 0 && res.skipped > 0) {
    toast(`All ${res.skipped} guardian account(s) already exist.`, "info");
    return;
  }
  toast(`${res.created} guardian account(s) created.`, "success");
}

export function toastAdmissionImport(toast: ToastFn, res: AdmissionBatchResponse): void {
  if (res.failed > 0 && res.created === 0) {
    toast(`Import failed — ${res.failed} row(s) invalid.`, "error");
    return;
  }
  if (res.failed > 0) {
    toast(`${res.created} application(s) added · ${res.failed} failed.`, "warning");
    return;
  }
  toast(`${res.created} application(s) added to the pipeline.`, "success");
}
