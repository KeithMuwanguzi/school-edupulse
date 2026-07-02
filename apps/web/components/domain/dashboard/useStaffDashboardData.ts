"use client";

import { FINANCE_ROLES, roleHasAny } from "@/lib/roleAccess";
import type { Me } from "@/lib/types";
import {
  useAcademicContextQuery,
  useAssessmentSummaryQuery,
  useAttendanceSummaryQuery,
  useFinanceSummaryQuery,
  useGetTenantSchoolQuery,
  useHrPayrollSummaryQuery,
  useListAdmissionApplicationsQuery,
  useListClassesQuery,
  useListCircularsQuery,
  useListSubjectsQuery,
  useListTeacherAssignmentsQuery,
  useRegistrationSummaryQuery,
  useRosterSummaryQuery,
  useTimetableMyDayQuery,
} from "@/store/api/skulpulseApi";
import { todayIso } from "./dashboardUtils";

export function useStaffDashboardData(user: Me | null) {
  const role = user?.role;
  const moduleKeys = user?.modules ?? [];
  const has = (m: string) => moduleKeys.includes(m);

  const isAdmin = role === "school_admin";
  const isTeacher = role === "teacher";
  const isStaffLead = roleHasAny(role, "school_admin", "deputy_head");
  const canSeeFinance = has("finance") && roleHasAny(role, ...FINANCE_ROLES);
  const canSeeHrAdmin = has("hr_payroll") && isStaffLead;
  const canSeeAdmissions = has("admissions") && isStaffLead;
  const canSeeCircularsAdmin = has("communication") && isStaffLead;

  const { data: school } = useGetTenantSchoolQuery();
  const { data: ctx } = useAcademicContextQuery();
  const { data: roster } = useRosterSummaryQuery(undefined, { skip: !has("students") });
  const { data: attendance } = useAttendanceSummaryQuery(
    { date: todayIso },
    { skip: !has("attendance") },
  );
  const { data: registration } = useRegistrationSummaryQuery(undefined, {
    skip: !has("students"),
  });
  const { data: finance } = useFinanceSummaryQuery(undefined, { skip: !canSeeFinance });
  const { data: assessment } = useAssessmentSummaryQuery(undefined, { skip: !has("assessment") });
  const { data: hr } = useHrPayrollSummaryQuery(undefined, { skip: !canSeeHrAdmin });
  const { data: admissions = [] } = useListAdmissionApplicationsQuery(undefined, {
    skip: !canSeeAdmissions,
  });
  const { data: circulars = [] } = useListCircularsQuery({ status: "draft" }, {
    skip: !canSeeCircularsAdmin,
  });
  const { data: classes } = useListClassesQuery(undefined, { skip: !isAdmin });
  const { data: subjects } = useListSubjectsQuery(undefined, { skip: !isAdmin });
  const { data: assignments = [] } = useListTeacherAssignmentsQuery(
    { teacherUserId: user?.id },
    { skip: !isTeacher || !has("teachers") },
  );
  const { data: myDay } = useTimetableMyDayQuery(
    { date: todayIso },
    { skip: !isTeacher || !has("timetable") },
  );

  const pendingAdmissions = admissions.filter((a) =>
    ["application", "interview", "accepted"].includes(a.status),
  );

  const classCount = roster?.classes.length ?? classes?.length ?? null;

  return {
    role,
    school,
    ctx,
    roster,
    attendance,
    registration,
    finance,
    assessment,
    hr,
    pendingAdmissions,
    circulars,
    classCount,
    subjects,
    assignments,
    myDay,
    has,
    isAdmin,
    isTeacher,
    isStaffLead,
    canSeeFinance,
    canSeeHrAdmin,
    canSeeAdmissions,
    canSeeCircularsAdmin,
  };
}

export type StaffDashboardData = ReturnType<typeof useStaffDashboardData>;
