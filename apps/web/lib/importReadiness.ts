import type { ClassOut, SubjectOut } from "@/lib/types";

export type ImportFlow = "students" | "timetable" | "staff" | "guardians" | "admissions";

export type ImportIssueSeverity = "block" | "warn" | "info";

export interface ImportReadinessIssue {
  severity: ImportIssueSeverity;
  message: string;
  href?: string;
  actionLabel?: string;
}

const PRIMARY_LEVELS = new Set(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);

export interface ImportReadinessInput {
  flow: ImportFlow;
  classes?: ClassOut[];
  subjects?: SubjectOut[];
  teacherCount?: number;
  studentCount?: number;
  activeTermLabel?: string | null;
}

export function evaluateImportReadiness(input: ImportReadinessInput): {
  issues: ImportReadinessIssue[];
  canProceed: boolean;
} {
  const issues: ImportReadinessIssue[] = [];
  const classes = input.classes ?? [];
  const activeClasses = classes.filter((c) => c.is_active);

  if (input.flow === "students") {
    if (activeClasses.length === 0) {
      issues.push({
        severity: "block",
        message: "No classes set up yet. Pupils cannot be placed without classes.",
        href: "/app/m/academics",
        actionLabel: "Set up classes",
      });
    } else {
      const primaryWithoutStreams = activeClasses.filter(
        (c) => PRIMARY_LEVELS.has(c.level) && c.streams.filter((s) => s.is_active).length === 0,
      );
      if (primaryWithoutStreams.length > 0) {
        issues.push({
          severity: "warn",
          message:
            "Some primary classes have no streams. If your spreadsheet lists stream A or B, add those streams under Academics first — otherwise leave the stream column empty.",
          href: "/app/m/academics",
          actionLabel: "Manage classes",
        });
      }
      issues.push({
        severity: "info",
        message:
          "Import order: classes → (optional streams) → validate file → import. Wrong class names or missing streams fail row-by-row; nothing partial is saved until you confirm import.",
      });
    }
  }

  if (input.flow === "timetable") {
    if (activeClasses.length === 0) {
      issues.push({
        severity: "block",
        message: "Create classes before building a timetable.",
        href: "/app/m/academics",
        actionLabel: "Set up classes",
      });
    }
    if ((input.subjects?.length ?? 0) === 0) {
      issues.push({
        severity: "block",
        message: "Add subjects to your catalogue before importing timetable rows.",
        href: "/app/settings/subjects",
        actionLabel: "Add subjects",
      });
    }
    if ((input.teacherCount ?? 0) === 0) {
      issues.push({
        severity: "block",
        message: "Import or create teacher accounts before assigning lessons.",
        href: "/app/settings/users",
        actionLabel: "Add staff",
      });
    }
    if (issues.every((i) => i.severity !== "block")) {
      issues.push({
        severity: "info",
        message:
          "Each row needs a valid class, subject code, and teacher (login ID or exact name). Upload runs a dry-run check before anything is saved.",
      });
    }
  }

  if (input.flow === "staff") {
    issues.push({
      severity: "info",
      message:
        "Staff can be imported before or after pupils. Save generated passwords — they are shown once. Duplicate login IDs are skipped, not overwritten.",
    });
  }

  if (input.flow === "guardians") {
    if ((input.studentCount ?? 0) === 0) {
      issues.push({
        severity: "block",
        message:
          "No enrolled pupils yet. Import or enroll students first — guardian accounts link to an existing student number.",
        href: "/app/m/students",
        actionLabel: "Go to Students",
      });
    } else {
      issues.push({
        severity: "warn",
        message:
          "Each row must match a real student number from your roster. Unknown numbers are rejected — stub pupil records are not created.",
      });
    }
  }

  if (input.flow === "admissions") {
    if (activeClasses.length === 0) {
      issues.push({
        severity: "warn",
        message:
          "No classes yet. You can still import applicants if each row includes an entry class (P1–P7), or set up classes under Academics.",
        href: "/app/m/academics",
        actionLabel: "Set up classes",
      });
    }
    issues.push({
      severity: "info",
      message:
        "Admissions import adds pipeline applications only — accepted applicants still need full enrollment under Students.",
    });
  }

  if (!input.activeTermLabel && input.flow !== "staff" && input.flow !== "admissions") {
    issues.push({
      severity: "warn",
      message: "No active term is set. Confirm your academic calendar before term-scoped work (fees, marks, registration).",
      href: "/app/settings/academic-year",
      actionLabel: "Academic year",
    });
  }

  const canProceed = !issues.some((i) => i.severity === "block");
  return { issues, canProceed };
}
