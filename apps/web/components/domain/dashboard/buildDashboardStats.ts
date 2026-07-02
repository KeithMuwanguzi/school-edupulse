import { FINANCE_ROLES, roleHasAny } from "@/lib/roleAccess";
import type { DashboardStat, TermProgress } from "./dashboardUtils";
import { pct } from "./dashboardUtils";
import type { StaffDashboardData } from "./useStaffDashboardData";

const MAX_STATS = 4;

export function buildDashboardStats(data: StaffDashboardData): DashboardStat[] {
  const stats: DashboardStat[] = [];
  const { role } = data;
  const isTeacher = role === "teacher";
  const isStaffLead = data.isStaffLead;
  const canSeeFinance = data.canSeeFinance;

  if (isTeacher) {
    const lessons = data.myDay?.lessons ?? [];
    const recorded = lessons.filter((l) => l.recorded).length;
    const open = lessons.filter((l) => l.can_record && !l.recorded).length;
    const classIds = new Set(data.assignments.map((a) => a.class_id));
    const subjectIds = new Set(data.assignments.map((a) => a.subject_id));

    if (data.has("timetable") || data.has("attendance")) {
      stats.push({
        icon: "calendar",
        label: "Lessons today",
        value: String(lessons.length),
        hint: lessons.length > 0 ? `${recorded} recorded · ${open} to mark` : "No lessons scheduled",
        accent: open > 0 ? "amber" : "brand",
        href: "/app/m/attendance",
      });
    }

    if (data.has("teachers") && data.assignments.length > 0) {
      stats.push({
        icon: "graduation",
        label: "Teaching load",
        value: `${classIds.size} · ${subjectIds.size}`,
        hint: `${classIds.size} classes · ${subjectIds.size} subjects`,
        accent: "blue",
        href: "/app/m/timetable",
      });
    }

    if (data.has("assessment") && data.assessment) {
      stats.push({
        icon: "book",
        label: "Open sets",
        value: String(data.assessment.open_sets),
        hint:
          data.assessment.open_sets > 0
            ? "Ready for mark entry"
            : `${data.assessment.total_marks.toLocaleString()} marks recorded`,
        accent: data.assessment.open_sets > 0 ? "gold" : "slate",
        href: "/app/m/assessment",
      });
    }

    if (data.has("attendance") && data.attendance) {
      const marked = data.attendance.total_marked;
      const rate = pct(data.attendance.present, marked);
      stats.push({
        icon: "percent",
        label: "School attendance",
        value: rate === null ? "—" : `${rate}%`,
        hint: marked > 0 ? "Present today school-wide" : "Roll not taken yet",
        accent: "gold",
        href: "/app/m/attendance",
      });
    }
  } else {
    if (data.has("students") && data.roster) {
      stats.push({
        icon: "graduation",
        label: "Students",
        value: data.roster.total.toLocaleString(),
        hint: data.roster.unassigned > 0 ? `${data.roster.unassigned} unassigned` : "All placed",
        accent: data.roster.unassigned > 0 ? "amber" : "brand",
        href: "/app/m/students",
      });
    }

    if (data.has("attendance") && data.attendance) {
      const marked = data.attendance.total_marked;
      const rate = pct(data.attendance.present, marked);
      stats.push({
        icon: "percent",
        label: "Attendance today",
        value: rate === null ? "—" : `${rate}%`,
        hint:
          marked > 0
            ? `${marked}/${data.attendance.total_enrolled} marked`
            : "Roll not taken yet",
        accent: "gold",
        href: "/app/m/attendance",
      });
    }

    if (data.has("students") && data.registration && data.registration.total_students > 0) {
      const completePct = pct(data.registration.complete, data.registration.total_students) ?? 0;
      stats.push({
        icon: "clipboard",
        label: "Term check-in",
        value: `${completePct}%`,
        hint: `${data.registration.complete}/${data.registration.total_students} complete`,
        accent: completePct >= 90 ? "emerald" : "blue",
        href: "/app/m/students/registration",
      });
    }

    if (canSeeFinance && data.finance) {
      const collectedPct =
        data.finance.total_invoiced_ugx > 0
          ? pct(data.finance.total_collected_ugx, data.finance.total_invoiced_ugx)
          : null;
      stats.push({
        icon: "wallet",
        label: "Fees collected",
        value: collectedPct === null ? "—" : `${collectedPct}%`,
        hint:
          data.finance.total_outstanding_ugx > 0
            ? "Outstanding balance remains"
            : `${data.finance.invoiced_count} invoiced`,
        accent: "blue",
        href: "/app/m/finance",
      });
    }

    if (isStaffLead && data.canSeeAdmissions && data.pendingAdmissions.length > 0) {
      stats.push({
        icon: "users",
        label: "Admissions",
        value: String(data.pendingAdmissions.length),
        hint: "Applications in pipeline",
        accent: "amber",
        href: "/app/m/admissions",
      });
    }

    if (data.has("assessment") && data.assessment && stats.length < MAX_STATS) {
      stats.push({
        icon: "book",
        label: "Assessment",
        value: String(data.assessment.open_sets),
        hint: `${data.assessment.open_sets} open · ${data.assessment.closed_sets} closed`,
        accent: data.assessment.open_sets > 0 ? "gold" : "slate",
        href: "/app/m/assessment",
      });
    }

    if (data.canSeeHrAdmin && data.hr && stats.length < MAX_STATS) {
      stats.push({
        icon: "users",
        label: "Pending leave",
        value: String(data.hr.pending_leave),
        hint:
          data.hr.pending_leave > 0
            ? "Awaiting approval"
            : `${data.hr.active_employees} active staff`,
        accent: data.hr.pending_leave > 0 ? "amber" : "slate",
        href: "/app/m/hr_payroll",
      });
    }

    if (data.classCount !== null && stats.length < MAX_STATS && roleHasAny(role, "school_admin", "deputy_head")) {
      stats.push({
        icon: "grid",
        label: "Classes",
        value: String(data.classCount),
        hint: data.subjects ? `${data.subjects.length} subjects` : "This academic year",
        accent: "slate",
        href: "/app/m/academics",
      });
    }
  }

  if (stats.length < MAX_STATS && data.ctx?.active_term?.label) {
    stats.push({
      icon: "calendar",
      label: "Active term",
      value: data.ctx.active_term.label,
      hint: data.ctx.academic_year?.label ?? "This year",
      accent: "gold",
    });
  }

  return stats.slice(0, MAX_STATS);
}

export function roleLabel(role: string | undefined): string {
  if (!role) return "Staff";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export { type TermProgress };
