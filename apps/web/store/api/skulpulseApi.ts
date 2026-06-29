import {
  BaseQueryApi,
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_URL } from "@/lib/apiConfig";
import { newRequestId, tokenStorage } from "@/lib/tokenStorage";
import type { RootState } from "@/store";
import { clearAuth, setAccessToken } from "@/store/slices/authSlice";
import type {
  AcademicContext,
  AcademicYearOut,
  TermOut,
  AcademicYearWithTerms,
  TermCalendarEventOut,
  CircularOut,
  HrPayrollSummaryOut,
  EmployeeOut,
  LeaveTypeOut,
  LeaveRequestOut,
  PayrollRunOut,
  PayslipOut,
  CursorPage,
  ErrorLogItem,
  InvoiceBreakdown,
  Me,
  ModuleCatalogItem,
  PortalUser,
  RequestLogItem,
  SchoolDetail,
  SchoolCodeSuggestion,
  SchoolListItem,
  SubjectOut,
  ClassOut,
  StudentOut,
  StudentDetailOut,
  StudentGuardianOut,
  StudentHealthOut,
  StudentDisciplineOut,
  RosterSummaryOut,
  StudentImportResponse,
  BulkAssignResponse,
  TeacherStaffOut,
  TeacherAssignmentOut,
  AttendanceDailySummary,
  AttendanceRollOut,
  AttendanceMarkResponse,
  ClassAttendanceDayOut,
  TimetableSlotOut,
  TeacherDayOut,
  TimetableImportResponse,
  RegistrationConfigOut,
  RegistrationSectionOut,
  RegistrationRequirementOut,
  RegistrationSummaryOut,
  RegistrationQueueItemOut,
  RegistrationDetailOut,
  RegisteredRosterSummaryOut,
  RegisteredStudentOut,
  AdmissionApplicationOut,
  AdmissionBatchResponse,
  GradingConfigOut,
  GradeRangeOut,
  GradingScaleOut,
  CycleGradingSectionOut,
  SubjectGradingOut,
  AggregateDivisionOut,
  AuditLogFileItem,
  AuditLogItem,
  PlatformAdminCreateResponse,
  PlatformAdminOut,
  ReportCardClassOption,
  ReportCardPreviewOut,
  ReportCardStudentOut,
  PleCandidateOut,
  PleEligibleStudentOut,
  PleCandidacySummaryOut,
  FinanceSummaryOut,
  FeeStructureOut,
  FeeInvoiceOut,
  FeeInvoiceDetailOut,
  InvoiceGenerateOut,
  AssessmentSetOut,
  TermCaConfigOut,
  AssessmentSummaryOut,
  MarkEntryRosterOut,
  ComputedCaOut,
  MarksGridOut,
  MarksImportRequest,
  MarksImportResponse,
  StudentPerformanceOut,
  HostelOut,
  HostelDetailOut,
  HostelOption,
  HostelRoomOut,
  PasswordResetStubResponse,
  ImportUsersResponse,
  RoleOption,
  TenantModules,
  TokenResponse,
} from "@/lib/types";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Request-ID", newRequestId());
    return headers;
  },
});

// Single-flight refresh: concurrent 401s must share ONE /auth/refresh, otherwise
// they each send the same (rotating) token and trip server reuse detection (§4.8).
let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(api: BaseQueryApi, extraOptions: object): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = tokenStorage.getRefresh();
      if (!refresh) return false;
      const res = await rawBaseQuery(
        { url: "/auth/refresh", method: "POST", body: { refresh_token: refresh } },
        api,
        extraOptions,
      );
      const data = res.data as TokenResponse | undefined;
      if (data?.access_token) {
        tokenStorage.setRefresh(data.refresh_token);
        api.dispatch(setAccessToken(data.access_token));
        return true;
      }
      tokenStorage.clear();
      api.dispatch(clearAuth());
      return false;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Reauth wrapper: on 401, rotate the refresh token once (shared) and retry (§7.3).
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const ok = await refreshOnce(api, extraOptions ?? {});
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }
  return result;
};

function idempotent(): FetchArgs["headers"] {
  return { "Idempotency-Key": newRequestId() };
}

export const skulpulseApi = createApi({
  reducerPath: "skulpulseApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Schools", "School", "Me", "TenantSchool", "TenantModules", "AcademicCalendar", "TermCalendar", "Circulars", "HrPayroll", "Subjects", "Classes", "TenantUsers", "Students", "Teachers", "Attendance", "Timetable", "TermRegistration", "Grading", "Admissions", "ReportCards", "Finance", "Assessment", "Ple", "Hostel", "PlatformAdmins"],
  endpoints: (builder) => ({
    // --- Auth ---
    platformLogin: builder.mutation<TokenResponse, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/platform/login", method: "POST", body }),
    }),
    tenantLogin: builder.mutation<TokenResponse, { username: string; password: string }>({
      query: (body) => ({ url: "/auth/tenant/login", method: "POST", body }),
    }),
    logout: builder.mutation<void, { refresh_token: string }>({
      query: (body) => ({ url: "/auth/logout", method: "POST", body }),
    }),
    getMe: builder.query<Me, void>({
      query: () => "/auth/me",
      providesTags: ["Me"],
    }),
    changePassword: builder.mutation<
      TokenResponse,
      { current_password: string; new_password: string }
    >({
      query: (body) => ({ url: "/auth/tenant/change-password", method: "POST", body }),
      invalidatesTags: ["Me"],
    }),
    changePlatformPassword: builder.mutation<
      TokenResponse,
      { current_password: string; new_password: string }
    >({
      query: (body) => ({ url: "/auth/platform/change-password", method: "POST", body }),
      invalidatesTags: ["Me"],
    }),

    // --- Platform: schools ---
    listSchools: builder.query<
      CursorPage<SchoolListItem>,
      { status?: string; cursor?: string; limit?: number } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.status) p.set("status", params.status);
        if (params?.cursor) p.set("cursor", params.cursor);
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/platform/schools${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Schools"],
    }),
    suggestSchoolCode: builder.query<SchoolCodeSuggestion, { name: string }>({
      query: ({ name }) => {
        const p = new URLSearchParams({ name });
        return `/platform/schools/suggest-code?${p.toString()}`;
      },
    }),
    onboardSchool: builder.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({
        url: "/platform/schools",
        method: "POST",
        body,
        headers: idempotent(),
      }),
      invalidatesTags: ["Schools"],
    }),
    getSchool: builder.query<SchoolDetail, string>({
      query: (tenantId) => `/platform/schools/${tenantId}`,
      providesTags: ["School"],
    }),
    updateSchool: builder.mutation<
      SchoolDetail,
      { tenantId: string; body: Record<string, unknown> }
    >({
      query: ({ tenantId, body }) => ({
        url: `/platform/schools/${tenantId}`,
        method: "PATCH",
        body,
        headers: idempotent(),
      }),
      invalidatesTags: ["School", "Schools"],
    }),
    replaceModules: builder.mutation<
      SchoolDetail,
      { tenantId: string; module_keys: string[] }
    >({
      query: ({ tenantId, module_keys }) => ({
        url: `/platform/schools/${tenantId}/modules`,
        method: "PUT",
        body: { module_keys },
        headers: idempotent(),
      }),
      invalidatesTags: ["School", "Schools"],
    }),
    listSchoolUsers: builder.query<PortalUser[], string>({
      query: (tenantId) => `/platform/schools/${tenantId}/users`,
    }),
    resetPlatformUserPassword: builder.mutation<
      PasswordResetStubResponse,
      { tenantId: string; userId: string }
    >({
      query: ({ tenantId, userId }) => ({
        url: `/platform/schools/${tenantId}/users/${userId}/password-reset`,
        method: "POST",
      }),
    }),
    resetPlatformAdminCredentials: builder.mutation<PasswordResetStubResponse, string>({
      query: (tenantId) => ({
        url: `/platform/schools/${tenantId}/admin/reset-credentials`,
        method: "POST",
      }),
      invalidatesTags: ["School"],
    }),
    uploadPlatformSchoolBadge: builder.mutation<SchoolDetail, { tenantId: string; file: File }>({
      query: ({ tenantId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: `/platform/schools/${tenantId}/badge`,
          method: "POST",
          body,
        };
      },
      invalidatesTags: ["School"],
    }),
    deletePlatformSchoolBadge: builder.mutation<SchoolDetail, string>({
      query: (tenantId) => ({
        url: `/platform/schools/${tenantId}/badge`,
        method: "DELETE",
      }),
      invalidatesTags: ["School"],
    }),

    // --- Platform: catalog + logs ---
    moduleCatalog: builder.query<ModuleCatalogItem[], void>({
      query: () => "/platform/module-catalog",
    }),
    districts: builder.query<{ id: string; name: string; region?: string | null }[], void>({
      query: () => "/platform/districts",
    }),
    estimate: builder.mutation<InvoiceBreakdown, { module_keys: string[] }>({
      query: (body) => ({ url: "/platform/module-catalog/estimate", method: "POST", body }),
    }),
    requestLogs: builder.query<
      RequestLogItem[],
      {
        tenant_id?: string;
        status_code?: number;
        before?: string;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.tenant_id) p.set("tenant_id", params.tenant_id);
        if (params?.status_code) p.set("status_code", String(params.status_code));
        if (params?.before) p.set("before", params.before);
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/platform/logs/requests${qs ? `?${qs}` : ""}`;
      },
    }),
    errorLogs: builder.query<
      ErrorLogItem[],
      {
        tenant_id?: string;
        unresolved?: boolean;
        before?: string;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.tenant_id) p.set("tenant_id", params.tenant_id);
        if (params?.unresolved) p.set("unresolved", "true");
        if (params?.before) p.set("before", params.before);
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/platform/logs/errors${qs ? `?${qs}` : ""}`;
      },
    }),
    auditLogs: builder.query<
      AuditLogItem[],
      {
        tenant_id?: string;
        actor_type?: string;
        actor_id?: string;
        action?: string;
        before?: string;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.tenant_id) p.set("tenant_id", params.tenant_id);
        if (params?.actor_type) p.set("actor_type", params.actor_type);
        if (params?.actor_id) p.set("actor_id", params.actor_id);
        if (params?.action) p.set("action", params.action);
        if (params?.before) p.set("before", params.before);
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/platform/logs/audit${qs ? `?${qs}` : ""}`;
      },
    }),
    auditLogFiles: builder.query<AuditLogFileItem[], void>({
      query: () => "/platform/logs/files",
    }),
    listPlatformAdmins: builder.query<PlatformAdminOut[], void>({
      query: () => "/platform/admins",
      providesTags: ["PlatformAdmins"],
    }),
    createPlatformAdmin: builder.mutation<
      PlatformAdminCreateResponse,
      { email: string; name: string; password?: string; notify?: boolean }
    >({
      query: (body) => ({
        url: "/platform/admins",
        method: "POST",
        body,
      }),
      invalidatesTags: ["PlatformAdmins"],
    }),
    updatePlatformAdmin: builder.mutation<
      PlatformAdminOut,
      { adminId: string; body: { name?: string; email?: string; is_active?: boolean } }
    >({
      query: ({ adminId, body }) => ({
        url: `/platform/admins/${adminId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["PlatformAdmins"],
    }),
    deletePlatformAdmin: builder.mutation<void, string>({
      query: (adminId) => ({
        url: `/platform/admins/${adminId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PlatformAdmins"],
    }),
    resetPlatformAdminPassword: builder.mutation<PasswordResetStubResponse, string>({
      query: (adminId) => ({
        url: `/platform/admins/${adminId}/password-reset`,
        method: "POST",
      }),
    }),
    resetPlatformData: builder.mutation<
      { platform_admins_preserved: number; tables_truncated: number },
      { confirmation: string }
    >({
      query: (body) => ({
        url: "/platform/system/reset-data",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Schools"],
    }),

    // --- Tenant self-service ---
    getTenantSchool: builder.query<SchoolDetail, void>({
      query: () => "/tenant/school",
      providesTags: ["TenantSchool"],
    }),
    updateTenantSchool: builder.mutation<SchoolDetail, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/school", method: "PATCH", body }),
      invalidatesTags: ["TenantSchool"],
    }),
    uploadTenantSchoolBadge: builder.mutation<SchoolDetail, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/tenant/school/badge", method: "POST", body };
      },
      invalidatesTags: ["TenantSchool"],
    }),
    deleteTenantSchoolBadge: builder.mutation<SchoolDetail, void>({
      query: () => ({ url: "/tenant/school/badge", method: "DELETE" }),
      invalidatesTags: ["TenantSchool"],
    }),
    tenantModuleCatalog: builder.query<ModuleCatalogItem[], void>({
      query: () => "/tenant/module-catalog",
    }),
    getTenantModules: builder.query<TenantModules, void>({
      query: () => "/tenant/modules",
      providesTags: ["TenantModules"],
    }),
    academicContext: builder.query<AcademicContext, void>({
      query: () => "/tenant/academic-context",
      providesTags: ["AcademicCalendar"],
    }),
    listAcademicYears: builder.query<AcademicYearWithTerms[], void>({
      query: () => "/tenant/academic-years",
      providesTags: ["AcademicCalendar"],
    }),
    createAcademicYear: builder.mutation<AcademicYearWithTerms, { label: string }>({
      query: (body) => ({ url: "/tenant/academic-years", method: "POST", body }),
      invalidatesTags: ["AcademicCalendar"],
    }),
    updateAcademicYear: builder.mutation<
      AcademicYearWithTerms,
      { yearId: string; body: Record<string, unknown> }
    >({
      query: ({ yearId, body }) => ({
        url: `/tenant/academic-years/${yearId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AcademicCalendar"],
    }),
    activateAcademicYear: builder.mutation<AcademicYearWithTerms, string>({
      query: (yearId) => ({
        url: `/tenant/academic-years/${yearId}/activate`,
        method: "POST",
      }),
      invalidatesTags: ["AcademicCalendar"],
    }),
    updateTerm: builder.mutation<
      TermOut,
      { yearId: string; termId: string; body: Record<string, unknown> }
    >({
      query: ({ yearId, termId, body }) => ({
        url: `/tenant/academic-years/${yearId}/terms/${termId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AcademicCalendar"],
    }),
    activateTerm: builder.mutation<TermOut, { yearId: string; termId: string }>({
      query: ({ yearId, termId }) => ({
        url: `/tenant/academic-years/${yearId}/terms/${termId}/activate`,
        method: "POST",
      }),
      invalidatesTags: ["AcademicCalendar"],
    }),
    listTermCalendarEvents: builder.query<
      TermCalendarEventOut[],
      { yearId: string; termId?: string }
    >({
      query: ({ yearId, termId }) => {
        const p = termId ? `?term_id=${termId}` : "";
        return `/tenant/academic-years/${yearId}/calendar-events${p}`;
      },
      providesTags: (_r, _e, { yearId }) => [{ type: "TermCalendar", id: yearId }],
    }),
    createTermCalendarEvent: builder.mutation<
      TermCalendarEventOut,
      {
        yearId: string;
        termId: string;
        body: {
          event_type: string;
          title: string;
          starts_on: string;
          ends_on: string;
          description?: string | null;
        };
      }
    >({
      query: ({ yearId, termId, body }) => ({
        url: `/tenant/academic-years/${yearId}/terms/${termId}/calendar-events`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { yearId }) => [{ type: "TermCalendar", id: yearId }],
    }),
    updateTermCalendarEvent: builder.mutation<
      TermCalendarEventOut,
      {
        yearId: string;
        termId: string;
        eventId: string;
        body: Record<string, unknown>;
      }
    >({
      query: ({ yearId, termId, eventId, body }) => ({
        url: `/tenant/academic-years/${yearId}/terms/${termId}/calendar-events/${eventId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { yearId }) => [{ type: "TermCalendar", id: yearId }],
    }),
    deleteTermCalendarEvent: builder.mutation<
      void,
      { yearId: string; termId: string; eventId: string }
    >({
      query: ({ yearId, termId, eventId }) => ({
        url: `/tenant/academic-years/${yearId}/terms/${termId}/calendar-events/${eventId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { yearId }) => [{ type: "TermCalendar", id: yearId }],
    }),

    listCirculars: builder.query<CircularOut[], { status?: string } | void>({
      query: (args) => {
        const status = args && "status" in args && args.status ? `?status=${args.status}` : "";
        return `/tenant/circulars${status}`;
      },
      providesTags: ["Circulars"],
    }),
    listCircularInbox: builder.query<CircularOut[], void>({
      query: () => "/tenant/circulars/inbox",
      providesTags: ["Circulars"],
    }),
    getCircular: builder.query<CircularOut, string>({
      query: (circularId) => `/tenant/circulars/${circularId}`,
      providesTags: (_r, _e, id) => [{ type: "Circulars", id }],
    }),
    createCircular: builder.mutation<
      CircularOut,
      {
        title: string;
        body: string;
        audience: string;
        priority?: string;
        class_id?: string | null;
        stream_id?: string | null;
      }
    >({
      query: (body) => ({ url: "/tenant/circulars", method: "POST", body }),
      invalidatesTags: ["Circulars"],
    }),
    updateCircular: builder.mutation<
      CircularOut,
      { circularId: string; body: Record<string, unknown> }
    >({
      query: ({ circularId, body }) => ({
        url: `/tenant/circulars/${circularId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Circulars"],
    }),
    publishCircular: builder.mutation<CircularOut, string>({
      query: (circularId) => ({
        url: `/tenant/circulars/${circularId}/publish`,
        method: "POST",
      }),
      invalidatesTags: ["Circulars"],
    }),
    deleteCircular: builder.mutation<void, string>({
      query: (circularId) => ({
        url: `/tenant/circulars/${circularId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Circulars"],
    }),
    uploadCircularAttachment: builder.mutation<CircularOut, { circularId: string; file: File }>({
      query: ({ circularId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: `/tenant/circulars/${circularId}/attachment`,
          method: "POST",
          body,
        };
      },
      invalidatesTags: ["Circulars"],
    }),
    deleteCircularAttachment: builder.mutation<CircularOut, string>({
      query: (circularId) => ({
        url: `/tenant/circulars/${circularId}/attachment`,
        method: "DELETE",
      }),
      invalidatesTags: ["Circulars"],
    }),

    hrPayrollSummary: builder.query<HrPayrollSummaryOut, void>({
      query: () => "/tenant/hr-payroll/summary",
      providesTags: ["HrPayroll"],
    }),
    listHrEmployees: builder.query<EmployeeOut[], void>({
      query: () => "/tenant/hr-payroll/employees",
      providesTags: ["HrPayroll"],
    }),
    upsertEmployeeProfile: builder.mutation<
      EmployeeOut,
      { userId: string; body: Record<string, unknown> }
    >({
      query: ({ userId, body }) => ({
        url: `/tenant/hr-payroll/employees/${userId}/profile`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["HrPayroll"],
    }),
    listLeaveTypes: builder.query<LeaveTypeOut[], void>({
      query: () => "/tenant/hr-payroll/leave-types",
      providesTags: ["HrPayroll"],
    }),
    listLeaveRequests: builder.query<LeaveRequestOut[], { status?: string } | void>({
      query: (args) => {
        const status = args && "status" in args && args.status ? `?status=${args.status}` : "";
        return `/tenant/hr-payroll/leave-requests${status}`;
      },
      providesTags: ["HrPayroll"],
    }),
    listMyLeaveRequests: builder.query<LeaveRequestOut[], void>({
      query: () => "/tenant/hr-payroll/me/leave",
      providesTags: ["HrPayroll"],
    }),
    requestLeave: builder.mutation<
      LeaveRequestOut,
      { leave_type_id: string; starts_on: string; ends_on: string; reason?: string }
    >({
      query: (body) => ({ url: "/tenant/hr-payroll/me/leave", method: "POST", body }),
      invalidatesTags: ["HrPayroll"],
    }),
    approveLeave: builder.mutation<LeaveRequestOut, { requestId: string; review_note?: string }>({
      query: ({ requestId, review_note }) => ({
        url: `/tenant/hr-payroll/leave-requests/${requestId}/approve`,
        method: "POST",
        body: { review_note: review_note ?? null },
      }),
      invalidatesTags: ["HrPayroll"],
    }),
    rejectLeave: builder.mutation<LeaveRequestOut, { requestId: string; review_note?: string }>({
      query: ({ requestId, review_note }) => ({
        url: `/tenant/hr-payroll/leave-requests/${requestId}/reject`,
        method: "POST",
        body: { review_note: review_note ?? null },
      }),
      invalidatesTags: ["HrPayroll"],
    }),
    listPayrollRuns: builder.query<PayrollRunOut[], void>({
      query: () => "/tenant/hr-payroll/payroll-runs",
      providesTags: ["HrPayroll"],
    }),
    getPayrollRun: builder.query<PayrollRunOut, string>({
      query: (runId) => `/tenant/hr-payroll/payroll-runs/${runId}`,
      providesTags: (_r, _e, id) => [{ type: "HrPayroll", id }],
    }),
    createPayrollRun: builder.mutation<
      PayrollRunOut,
      { year: number; month: number; notes?: string }
    >({
      query: (body) => ({ url: "/tenant/hr-payroll/payroll-runs", method: "POST", body }),
      invalidatesTags: ["HrPayroll"],
    }),
    computePayrollRun: builder.mutation<PayrollRunOut, string>({
      query: (runId) => ({
        url: `/tenant/hr-payroll/payroll-runs/${runId}/compute`,
        method: "POST",
      }),
      invalidatesTags: ["HrPayroll"],
    }),
    finalizePayrollRun: builder.mutation<PayrollRunOut, string>({
      query: (runId) => ({
        url: `/tenant/hr-payroll/payroll-runs/${runId}/finalize`,
        method: "POST",
      }),
      invalidatesTags: ["HrPayroll"],
    }),
    listMyPayslips: builder.query<PayslipOut[], void>({
      query: () => "/tenant/hr-payroll/me/payslips",
      providesTags: ["HrPayroll"],
    }),

    listSubjects: builder.query<SubjectOut[], void>({
      query: () => "/tenant/subjects",
      providesTags: ["Subjects"],
    }),
    createSubject: builder.mutation<
      SubjectOut,
      {
        code: string;
        name: string;
        ncdc_cycle?: string;
        ncdc_cycles?: string[];
        is_core?: boolean;
        sort_order?: number;
      }
    >({
      query: (body) => ({ url: "/tenant/subjects", method: "POST", body }),
      invalidatesTags: ["Subjects", "Grading"],
    }),
    updateSubject: builder.mutation<
      SubjectOut,
      { subjectId: string; body: Record<string, unknown> }
    >({
      query: ({ subjectId, body }) => ({
        url: `/tenant/subjects/${subjectId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Subjects", "Grading"],
    }),
    deleteSubject: builder.mutation<void, string>({
      query: (subjectId) => ({
        url: `/tenant/subjects/${subjectId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Subjects", "Grading"],
    }),

    listClasses: builder.query<ClassOut[], void>({
      query: () => "/tenant/classes",
      providesTags: ["Classes"],
    }),
    setupPrimaryClasses: builder.mutation<ClassOut[], void>({
      query: () => ({ url: "/tenant/classes/setup-primary", method: "POST" }),
      invalidatesTags: ["Classes"],
    }),
    setupNurseryClasses: builder.mutation<ClassOut[], void>({
      query: () => ({ url: "/tenant/classes/setup-nursery", method: "POST" }),
      invalidatesTags: ["Classes"],
    }),
    createClass: builder.mutation<ClassOut, { level: string; label?: string }>({
      query: (body) => ({ url: "/tenant/classes", method: "POST", body }),
      invalidatesTags: ["Classes"],
    }),
    updateClass: builder.mutation<
      ClassOut,
      { classId: string; body: Record<string, unknown> }
    >({
      query: ({ classId, body }) => ({
        url: `/tenant/classes/${classId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Classes"],
    }),
    deleteClass: builder.mutation<void, string>({
      query: (classId) => ({ url: `/tenant/classes/${classId}`, method: "DELETE" }),
      invalidatesTags: ["Classes"],
    }),
    createStream: builder.mutation<
      ClassOut,
      { classId: string; name: string }
    >({
      query: ({ classId, name }) => ({
        url: `/tenant/classes/${classId}/streams`,
        method: "POST",
        body: { name },
      }),
      invalidatesTags: ["Classes"],
    }),
    updateStream: builder.mutation<
      ClassOut,
      { classId: string; streamId: string; body: Record<string, unknown> }
    >({
      query: ({ classId, streamId, body }) => ({
        url: `/tenant/classes/${classId}/streams/${streamId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Classes"],
    }),
    deleteStream: builder.mutation<
      ClassOut,
      { classId: string; streamId: string }
    >({
      query: ({ classId, streamId }) => ({
        url: `/tenant/classes/${classId}/streams/${streamId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Classes"],
    }),

    listTenantRoles: builder.query<RoleOption[], void>({
      query: () => "/tenant/roles",
    }),
    listTenantUsers: builder.query<PortalUser[], void>({
      query: () => "/tenant/users",
      providesTags: ["TenantUsers"],
    }),
    nextLoginId: builder.query<{ login_id: string }, void>({
      query: () => "/tenant/users/next-login-id",
      providesTags: ["TenantUsers"],
    }),
    createTenantUser: builder.mutation<
      PortalUser,
      {
        login_id?: string;
        name: string;
        role_key: string;
        password: string;
        email?: string;
        allowed_modules?: string[] | null;
      }
    >({
      query: (body) => ({ url: "/tenant/users", method: "POST", body }),
      invalidatesTags: ["TenantUsers"],
    }),
    updateTenantUser: builder.mutation<
      PortalUser,
      { userId: string; body: Record<string, unknown> }
    >({
      query: ({ userId, body }) => ({
        url: `/tenant/users/${userId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["TenantUsers"],
    }),
    resetTenantUserPassword: builder.mutation<PasswordResetStubResponse, string>({
      query: (userId) => ({
        url: `/tenant/users/${userId}/password-reset`,
        method: "POST",
      }),
    }),
    importTeachers: builder.mutation<
      ImportUsersResponse,
      {
        rows: { login_id: string; name: string; email?: string; role_key?: string }[];
        default_password?: string;
        generate_passwords?: boolean;
        line_offset?: number;
      }
    >({
      query: (body) => ({
        url: "/tenant/users/import/teachers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TenantUsers"],
    }),
    importGuardians: builder.mutation<
      ImportUsersResponse,
      {
        rows: {
          student_number: string;
          guardian_name: string;
          email?: string;
          student_first_name?: string;
          student_last_name?: string;
        }[];
        default_password?: string;
        generate_passwords?: boolean;
      }
    >({
      query: (body) => ({
        url: "/tenant/users/import/guardians",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TenantUsers"],
    }),

    listStudents: builder.query<
      CursorPage<StudentOut>,
      {
        cursor?: string;
        classId?: string;
        streamId?: string;
        unassigned?: boolean;
        q?: string;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.cursor) p.set("cursor", params.cursor);
        if (params?.classId) p.set("class_id", params.classId);
        if (params?.streamId) p.set("stream_id", params.streamId);
        if (params?.unassigned) p.set("unassigned", "true");
        if (params?.q) p.set("q", params.q);
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/tenant/students${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Students"],
    }),
    rosterSummary: builder.query<RosterSummaryOut, void>({
      query: () => "/tenant/students/roster-summary",
      providesTags: ["Students"],
    }),
    getStudent: builder.query<StudentOut, string>({
      query: (studentId) => `/tenant/students/${studentId}`,
      providesTags: ["Students"],
    }),
    getStudentDetail: builder.query<StudentDetailOut, string>({
      query: (studentId) => `/tenant/students/${studentId}/detail`,
      providesTags: ["Students"],
    }),
    createStudent: builder.mutation<StudentOut, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/students", method: "POST", body }),
      invalidatesTags: ["Students"],
    }),
    updateStudent: builder.mutation<
      StudentOut,
      { studentId: string; body: Record<string, unknown> }
    >({
      query: ({ studentId, body }) => ({
        url: `/tenant/students/${studentId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    deleteStudent: builder.mutation<void, string>({
      query: (studentId) => ({
        url: `/tenant/students/${studentId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Students"],
    }),
    importStudents: builder.mutation<
      StudentImportResponse,
      {
        rows: Record<string, unknown>[];
        skip_duplicates?: boolean;
        dry_run?: boolean;
        line_offset?: number;
      }
    >({
      query: (body) => ({
        url: "/tenant/students/import",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    bulkAssignStudents: builder.mutation<
      BulkAssignResponse,
      {
        student_ids: string[];
        class_id?: string;
        stream_id?: string;
        clear_class?: boolean;
      }
    >({
      query: (body) => ({
        url: "/tenant/students/bulk-assign",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Students"],
    }),

    // --- Guardians ---
    listGuardians: builder.query<StudentGuardianOut[], string>({
      query: (studentId) => `/tenant/students/${studentId}/guardians`,
      providesTags: ["Students"],
    }),
    addGuardian: builder.mutation<
      StudentGuardianOut,
      { studentId: string; body: Record<string, unknown> }
    >({
      query: ({ studentId, body }) => ({
        url: `/tenant/students/${studentId}/guardians`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    updateGuardian: builder.mutation<
      StudentGuardianOut,
      { guardianId: string; body: Record<string, unknown> }
    >({
      query: ({ guardianId, body }) => ({
        url: `/tenant/students/guardians/${guardianId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    deleteGuardian: builder.mutation<void, string>({
      query: (guardianId) => ({
        url: `/tenant/students/guardians/${guardianId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Students"],
    }),

    // --- Health ---
    getStudentHealth: builder.query<StudentHealthOut | null, string>({
      query: (studentId) => `/tenant/students/${studentId}/health`,
      providesTags: ["Students"],
    }),
    upsertStudentHealth: builder.mutation<
      StudentHealthOut,
      { studentId: string; body: Record<string, unknown> }
    >({
      query: ({ studentId, body }) => ({
        url: `/tenant/students/${studentId}/health`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Students"],
    }),

    // --- Discipline ---
    listDisciplineSchoolWide: builder.query<StudentDisciplineOut[], { status?: string } | void>({
      query: (params) => {
        const qs = params?.status ? `?status=${params.status}` : "";
        return `/tenant/students/discipline${qs}`;
      },
      providesTags: ["Students"],
    }),
    listStudentDiscipline: builder.query<StudentDisciplineOut[], string>({
      query: (studentId) => `/tenant/students/${studentId}/discipline`,
      providesTags: ["Students"],
    }),
    addDiscipline: builder.mutation<
      StudentDisciplineOut,
      { studentId: string; body: Record<string, unknown> }
    >({
      query: ({ studentId, body }) => ({
        url: `/tenant/students/${studentId}/discipline`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    updateDiscipline: builder.mutation<
      StudentDisciplineOut,
      { recordId: string; body: Record<string, unknown> }
    >({
      query: ({ recordId, body }) => ({
        url: `/tenant/students/discipline/${recordId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Students"],
    }),
    deleteDiscipline: builder.mutation<void, string>({
      query: (recordId) => ({
        url: `/tenant/students/discipline/${recordId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Students"],
    }),

    listTeacherStaff: builder.query<TeacherStaffOut[], void>({
      query: () => "/tenant/teachers/staff",
      providesTags: ["Teachers"],
    }),
    listTeacherAssignments: builder.query<
      TeacherAssignmentOut[],
      { teacherUserId?: string; classId?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.teacherUserId) p.set("teacher_user_id", params.teacherUserId);
        if (params?.classId) p.set("class_id", params.classId);
        const qs = p.toString();
        return `/tenant/teachers/assignments${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Teachers"],
    }),
    createTeacherAssignment: builder.mutation<
      TeacherAssignmentOut,
      {
        teacher_user_id: string;
        class_id: string;
        subject_id: string;
        stream_id?: string;
        term_id?: string;
        is_class_teacher?: boolean;
      }
    >({
      query: (body) => ({
        url: "/tenant/teachers/assignments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Teachers"],
    }),
    deleteTeacherAssignment: builder.mutation<void, string>({
      query: (assignmentId) => ({
        url: `/tenant/teachers/assignments/${assignmentId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Teachers"],
    }),
    updateTeacherAssignment: builder.mutation<
      TeacherAssignmentOut,
      { assignmentId: string; body: Record<string, unknown> }
    >({
      query: ({ assignmentId, body }) => ({
        url: `/tenant/teachers/assignments/${assignmentId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Teachers"],
    }),
    attendanceSummary: builder.query<AttendanceDailySummary, { date?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.date) p.set("date", params.date);
        const qs = p.toString();
        return `/tenant/attendance/summary${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Attendance"],
    }),
    attendanceRoll: builder.query<
      AttendanceRollOut,
      { classId: string; streamId?: string; date?: string; timetableSlotId?: string }
    >({
      query: ({ classId, streamId, date, timetableSlotId }) => {
        const p = new URLSearchParams({ class_id: classId });
        if (streamId) p.set("stream_id", streamId);
        if (date) p.set("date", date);
        if (timetableSlotId) p.set("timetable_slot_id", timetableSlotId);
        return `/tenant/attendance/roll?${p.toString()}`;
      },
      providesTags: ["Attendance"],
    }),
    attendanceClassDay: builder.query<
      ClassAttendanceDayOut,
      { classId: string; streamId?: string; date?: string }
    >({
      query: ({ classId, streamId, date }) => {
        const p = new URLSearchParams({ class_id: classId });
        if (streamId) p.set("stream_id", streamId);
        if (date) p.set("date", date);
        return `/tenant/attendance/class-day?${p.toString()}`;
      },
      providesTags: ["Attendance"],
    }),
    markAttendance: builder.mutation<
      AttendanceMarkResponse,
      {
        class_id: string;
        stream_id?: string;
        timetable_slot_id?: string;
        date?: string;
        records: { student_id: string; status: string; remarks?: string }[];
      }
    >({
      query: (body) => ({
        url: "/tenant/attendance/mark",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Attendance", "Timetable"],
    }),

    // --- Timetable ---
    listTimetableSlots: builder.query<TimetableSlotOut[], void>({
      query: () => "/tenant/timetable/slots",
      providesTags: ["Timetable"],
    }),
    timetableMyDay: builder.query<TeacherDayOut, { date?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.date) p.set("date", params.date);
        const qs = p.toString();
        return `/tenant/timetable/my-day${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Timetable"],
    }),
    createTimetableSlot: builder.mutation<
      TimetableSlotOut,
      {
        day_of_week: number;
        starts_at: string;
        ends_at: string;
        class_id: string;
        stream_id?: string;
        subject_id: string;
        teacher_user_id: string;
        period_label?: string;
        room?: string;
      }
    >({
      query: (body) => ({ url: "/tenant/timetable/slots", method: "POST", body }),
      invalidatesTags: ["Timetable"],
    }),
    deleteTimetableSlot: builder.mutation<void, string>({
      query: (slotId) => ({ url: `/tenant/timetable/slots/${slotId}`, method: "DELETE" }),
      invalidatesTags: ["Timetable"],
    }),
    updateTimetableSlot: builder.mutation<
      TimetableSlotOut,
      {
        slotId: string;
        body: {
          day_of_week: number;
          starts_at: string;
          ends_at: string;
          class_id: string;
          stream_id?: string;
          subject_id: string;
          teacher_user_id: string;
          period_label?: string;
          room?: string;
        };
      }
    >({
      query: ({ slotId, body }) => ({
        url: `/tenant/timetable/slots/${slotId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Timetable"],
    }),
    importTimetable: builder.mutation<
      TimetableImportResponse,
      {
        rows: {
          day: string;
          starts_at: string;
          ends_at: string;
          class_level: string;
          stream_name?: string;
          subject_code: string;
          teacher: string;
          room?: string;
        }[];
        dry_run?: boolean;
      }
    >({
      query: (body) => ({ url: "/tenant/timetable/import", method: "POST", body }),
      invalidatesTags: ["Timetable"],
    }),

    // --- Term registration config ---
    getRegistrationConfig: builder.query<RegistrationConfigOut, void>({
      query: () => "/tenant/registration/config",
      providesTags: ["TermRegistration"],
    }),
    createRegistrationSection: builder.mutation<
      RegistrationSectionOut,
      { label: string; description?: string; icon?: string }
    >({
      query: (body) => ({ url: "/tenant/registration/sections", method: "POST", body }),
      invalidatesTags: ["TermRegistration"],
    }),
    updateRegistrationSection: builder.mutation<
      RegistrationSectionOut,
      { sectionId: string; body: Record<string, unknown> }
    >({
      query: ({ sectionId, body }) => ({
        url: `/tenant/registration/sections/${sectionId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    deleteRegistrationSection: builder.mutation<void, string>({
      query: (sectionId) => ({
        url: `/tenant/registration/sections/${sectionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    reorderRegistrationSections: builder.mutation<
      RegistrationConfigOut,
      { section_ids: string[] }
    >({
      query: (body) => ({
        url: "/tenant/registration/sections/reorder",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    createRegistrationRequirement: builder.mutation<
      RegistrationRequirementOut,
      { sectionId: string; body: Record<string, unknown> }
    >({
      query: ({ sectionId, body }) => ({
        url: `/tenant/registration/sections/${sectionId}/requirements`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    updateRegistrationRequirement: builder.mutation<
      RegistrationRequirementOut,
      { requirementId: string; body: Record<string, unknown> }
    >({
      query: ({ requirementId, body }) => ({
        url: `/tenant/registration/requirements/${requirementId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    deleteRegistrationRequirement: builder.mutation<void, string>({
      query: (requirementId) => ({
        url: `/tenant/registration/requirements/${requirementId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TermRegistration"],
    }),

    // --- Term registration workflow ---
    registeredRosterSummary: builder.query<
      RegisteredRosterSummaryOut,
      { termId?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        const qs = p.toString();
        return `/tenant/registration/roster-summary${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["TermRegistration"],
    }),
    registeredRoster: builder.query<
      RegisteredStudentOut[],
      {
        termId?: string;
        q?: string;
        classId?: string;
        streamId?: string;
        unassigned?: boolean;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        if (params?.q) p.set("q", params.q);
        if (params?.classId) p.set("class_id", params.classId);
        if (params?.streamId) p.set("stream_id", params.streamId);
        if (params?.unassigned) p.set("unassigned", "true");
        if (params?.limit) p.set("limit", String(params.limit));
        const qs = p.toString();
        return `/tenant/registration/roster${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["TermRegistration"],
    }),
    registrationSummary: builder.query<RegistrationSummaryOut, { termId?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        const qs = p.toString();
        return `/tenant/registration/summary${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["TermRegistration"],
    }),
    registrationQueue: builder.query<
      RegistrationQueueItemOut[],
      {
        termId?: string;
        status?: string;
        q?: string;
        classId?: string;
        streamId?: string;
        unassigned?: boolean;
      } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        if (params?.status) p.set("status", params.status);
        if (params?.q) p.set("q", params.q);
        if (params?.classId) p.set("class_id", params.classId);
        if (params?.streamId) p.set("stream_id", params.streamId);
        if (params?.unassigned) p.set("unassigned", "true");
        const qs = p.toString();
        return `/tenant/registration/queue${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["TermRegistration"],
    }),
    getRegistration: builder.query<RegistrationDetailOut, string>({
      query: (registrationId) => `/tenant/registration/${registrationId}`,
      providesTags: ["TermRegistration"],
    }),
    startRegistration: builder.mutation<
      RegistrationDetailOut,
      { student_id: string; term_id?: string }
    >({
      query: (body) => ({ url: "/tenant/registration", method: "POST", body }),
      invalidatesTags: ["TermRegistration"],
    }),
    upsertRegistrationResponses: builder.mutation<
      RegistrationDetailOut,
      { registrationId: string; responses: Record<string, unknown>[] }
    >({
      query: ({ registrationId, responses }) => ({
        url: `/tenant/registration/${registrationId}/responses`,
        method: "PUT",
        body: { responses },
      }),
      invalidatesTags: ["TermRegistration"],
    }),
    completeRegistration: builder.mutation<RegistrationDetailOut, string>({
      query: (registrationId) => ({
        url: `/tenant/registration/${registrationId}/complete`,
        method: "POST",
      }),
      invalidatesTags: ["TermRegistration"],
    }),

    // --- Admissions pipeline (Phase 2 §14) ---
    listAdmissionApplications: builder.query<
      AdmissionApplicationOut[],
      { status?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.status) p.set("status", params.status);
        const qs = p.toString();
        return `/tenant/admissions/applications${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Admissions"],
    }),
    getAdmissionApplication: builder.query<AdmissionApplicationOut, string>({
      query: (applicationId) => `/tenant/admissions/applications/${applicationId}`,
      providesTags: ["Admissions"],
    }),
    createAdmissionApplication: builder.mutation<
      AdmissionApplicationOut,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: "/tenant/admissions/applications",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Admissions"],
    }),
    batchCreateAdmissionApplications: builder.mutation<
      AdmissionBatchResponse,
      { rows: Record<string, unknown>[] }
    >({
      query: (body) => ({
        url: "/tenant/admissions/applications/batch",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Admissions"],
    }),
    updateAdmissionApplication: builder.mutation<
      AdmissionApplicationOut,
      { applicationId: string; body: Record<string, unknown> }
    >({
      query: ({ applicationId, body }) => ({
        url: `/tenant/admissions/applications/${applicationId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Admissions"],
    }),
    linkAdmissionEnrollment: builder.mutation<
      AdmissionApplicationOut,
      { applicationId: string; studentId: string }
    >({
      query: ({ applicationId, studentId }) => ({
        url: `/tenant/admissions/applications/${applicationId}/enroll`,
        method: "POST",
        body: { student_id: studentId },
      }),
      invalidatesTags: ["Admissions", "Students"],
    }),

    // --- Report cards (Phase 2 §10) ---
    reportCardClasses: builder.query<ReportCardClassOption[], { termId?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        const qs = p.toString();
        return `/tenant/reportcards/classes${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["ReportCards"],
    }),
    reportCardStudents: builder.query<
      ReportCardStudentOut[],
      { classId: string; streamId?: string; termId?: string }
    >({
      query: ({ classId, streamId, termId }) => {
        const p = new URLSearchParams({ class_id: classId });
        if (streamId) p.set("stream_id", streamId);
        if (termId) p.set("term_id", termId);
        return `/tenant/reportcards/students?${p.toString()}`;
      },
      providesTags: ["ReportCards"],
    }),
    reportCardPreview: builder.query<
      ReportCardPreviewOut,
      { studentId: string; termId?: string }
    >({
      query: ({ studentId, termId }) => {
        const p = new URLSearchParams({ student_id: studentId });
        if (termId) p.set("term_id", termId);
        return `/tenant/reportcards/preview?${p.toString()}`;
      },
      providesTags: (_result, _error, arg) => [
        { type: "ReportCards", id: `preview-${arg.studentId}` },
      ],
    }),

    // --- P7 PLE candidacy (Phase 2 §11) ---
    pleSummary: builder.query<PleCandidacySummaryOut, { academicYearId?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.academicYearId) p.set("academic_year_id", params.academicYearId);
        const qs = p.toString();
        return `/tenant/ple/summary${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Ple"],
    }),
    pleCandidates: builder.query<
      PleCandidateOut[],
      { academicYearId?: string; status?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.academicYearId) p.set("academic_year_id", params.academicYearId);
        if (params?.status) p.set("status", params.status);
        const qs = p.toString();
        return `/tenant/ple/candidates${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Ple"],
    }),
    pleEligible: builder.query<PleEligibleStudentOut[], { academicYearId?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.academicYearId) p.set("academic_year_id", params.academicYearId);
        const qs = p.toString();
        return `/tenant/ple/eligible${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Ple"],
    }),
    nominatePleCandidates: builder.mutation<
      PleCandidateOut[],
      { studentIds: string[]; academicYearId?: string }
    >({
      query: ({ studentIds, academicYearId }) => {
        const p = new URLSearchParams();
        if (academicYearId) p.set("academic_year_id", academicYearId);
        const qs = p.toString();
        return {
          url: `/tenant/ple/candidates${qs ? `?${qs}` : ""}`,
          method: "POST",
          body: { student_ids: studentIds },
        };
      },
      invalidatesTags: ["Ple"],
    }),
    updatePleCandidate: builder.mutation<
      PleCandidateOut,
      { candidateId: string; body: Record<string, unknown> }
    >({
      query: ({ candidateId, body }) => ({
        url: `/tenant/ple/candidates/${candidateId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Ple"],
    }),

    // --- Grading configuration (Phase 2 §8 — Uganda PLE) ---
    getGradingConfig: builder.query<GradingConfigOut, void>({
      query: () => "/tenant/grading/config",
      providesTags: ["Grading"],
    }),
    createGradingScale: builder.mutation<
      GradingScaleOut,
      { name: string; ncdc_cycle: string; description?: string }
    >({
      query: (body) => ({ url: "/tenant/grading/scales", method: "POST", body }),
      invalidatesTags: ["Grading"],
    }),
    updateGradingScale: builder.mutation<
      GradingScaleOut,
      { scaleId: string; body: Record<string, unknown> }
    >({
      query: ({ scaleId, body }) => ({
        url: `/tenant/grading/scales/${scaleId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Grading"],
    }),
    deleteGradingScale: builder.mutation<void, string>({
      query: (scaleId) => ({
        url: `/tenant/grading/scales/${scaleId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Grading"],
    }),
    createScaleGradeRange: builder.mutation<
      GradeRangeOut,
      { scaleId: string; body: Record<string, unknown> }
    >({
      query: ({ scaleId, body }) => ({
        url: `/tenant/grading/scales/${scaleId}/ranges`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Grading"],
    }),
    updateScaleGradeRange: builder.mutation<
      GradeRangeOut,
      { scaleId: string; rangeId: string; body: Record<string, unknown> }
    >({
      query: ({ scaleId, rangeId, body }) => ({
        url: `/tenant/grading/scales/${scaleId}/ranges/${rangeId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Grading"],
    }),
    deleteScaleGradeRange: builder.mutation<
      void,
      { scaleId: string; rangeId: string }
    >({
      query: ({ scaleId, rangeId }) => ({
        url: `/tenant/grading/scales/${scaleId}/ranges/${rangeId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Grading"],
    }),
    assignSubjectGradingScale: builder.mutation<
      SubjectGradingOut,
      { subjectId: string; grading_scale_id: string | null; ncdc_cycle: string }
    >({
      query: ({ subjectId, grading_scale_id, ncdc_cycle }) => ({
        url: `/tenant/grading/subjects/${subjectId}/scale`,
        method: "PATCH",
        body: { grading_scale_id, ncdc_cycle },
      }),
      invalidatesTags: ["Grading"],
    }),
    createAggregateDivision: builder.mutation<AggregateDivisionOut, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/grading/aggregate-divisions", method: "POST", body }),
      invalidatesTags: ["Grading"],
    }),
    updateAggregateDivision: builder.mutation<
      AggregateDivisionOut,
      { divisionId: string; body: Record<string, unknown> }
    >({
      query: ({ divisionId, body }) => ({
        url: `/tenant/grading/aggregate-divisions/${divisionId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Grading"],
    }),
    deleteAggregateDivision: builder.mutation<void, string>({
      query: (divisionId) => ({
        url: `/tenant/grading/aggregate-divisions/${divisionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Grading"],
    }),

    // --- Finance (Phase 2 §12–§13) ---
    financeSummary: builder.query<
      FinanceSummaryOut,
      { termId?: string; classId?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        if (params?.classId) p.set("class_id", params.classId);
        const qs = p.toString();
        return `/tenant/finance/summary${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Finance"],
    }),
    feeStructures: builder.query<FeeStructureOut[], { termId?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        const qs = p.toString();
        return `/tenant/finance/structures${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Finance"],
    }),
    createFeeStructure: builder.mutation<
      FeeStructureOut,
      { name: string; termId?: string; dueOn?: string; notes?: string }
    >({
      query: (body) => ({
        url: "/tenant/finance/structures",
        method: "POST",
        body: {
          name: body.name,
          term_id: body.termId,
          due_on: body.dueOn,
          notes: body.notes,
        },
      }),
      invalidatesTags: ["Finance"],
    }),
    activateFeeStructure: builder.mutation<FeeStructureOut, string>({
      query: (structureId) => ({
        url: `/tenant/finance/structures/${structureId}/activate`,
        method: "POST",
      }),
      invalidatesTags: ["Finance"],
    }),
    updateFeeStructure: builder.mutation<
      FeeStructureOut,
      { structureId: string; body: Record<string, unknown> }
    >({
      query: ({ structureId, body }) => ({
        url: `/tenant/finance/structures/${structureId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Finance"],
    }),
    updateFeeStructureLine: builder.mutation<
      FeeStructureOut,
      { structureId: string; lineId: string; body: Record<string, unknown> }
    >({
      query: ({ structureId, lineId, body }) => ({
        url: `/tenant/finance/structures/${structureId}/lines/${lineId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Finance"],
    }),
    addFeeStructureLine: builder.mutation<
      FeeStructureOut,
      { structureId: string; body: Record<string, unknown> }
    >({
      query: ({ structureId, body }) => ({
        url: `/tenant/finance/structures/${structureId}/lines`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Finance"],
    }),
    deleteFeeStructureLine: builder.mutation<
      FeeStructureOut,
      { structureId: string; lineId: string }
    >({
      query: ({ structureId, lineId }) => ({
        url: `/tenant/finance/structures/${structureId}/lines/${lineId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Finance"],
    }),
    feeInvoices: builder.query<
      FeeInvoiceOut[],
      { termId?: string; status?: string; classId?: string; q?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        if (params?.status) p.set("status", params.status);
        if (params?.classId) p.set("class_id", params.classId);
        if (params?.q) p.set("q", params.q);
        const qs = p.toString();
        return `/tenant/finance/invoices${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Finance"],
    }),
    feeInvoiceDetail: builder.query<FeeInvoiceDetailOut, string>({
      query: (invoiceId) => `/tenant/finance/invoices/${invoiceId}`,
      providesTags: (_r, _e, id) => [{ type: "Finance", id: `invoice-${id}` }],
    }),
    generateFeeInvoices: builder.mutation<
      InvoiceGenerateOut,
      { termId?: string; refreshUnpaid?: boolean } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.termId) p.set("term_id", params.termId);
        if (params?.refreshUnpaid) p.set("refresh_unpaid", "true");
        const qs = p.toString();
        return {
          url: `/tenant/finance/invoices/generate${qs ? `?${qs}` : ""}`,
          method: "POST",
        };
      },
      invalidatesTags: ["Finance"],
    }),
    recordFeePayment: builder.mutation<
      FeeInvoiceDetailOut,
      { invoiceId: string; body: Record<string, unknown> }
    >({
      query: ({ invoiceId, body }) => ({
        url: `/tenant/finance/invoices/${invoiceId}/payments`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Finance"],
    }),

    assessmentSummary: builder.query<AssessmentSummaryOut, { termId?: string } | void>({
      query: (args) => {
        const qs = args?.termId ? `?term_id=${args.termId}` : "";
        return `/tenant/assessment/summary${qs}`;
      },
      providesTags: ["Assessment"],
    }),
    assessmentSets: builder.query<AssessmentSetOut[], { termId?: string } | void>({
      query: (args) => {
        const qs = args?.termId ? `?term_id=${args.termId}` : "";
        return `/tenant/assessment/sets${qs}`;
      },
      providesTags: ["Assessment"],
    }),
    createAssessmentSet: builder.mutation<
      AssessmentSetOut,
      { term_id: string; name: string; max_mark?: number; description?: string }
    >({
      query: (body) => ({ url: "/tenant/assessment/sets", method: "POST", body }),
      invalidatesTags: ["Assessment"],
    }),
    openAssessmentSet: builder.mutation<AssessmentSetOut, string>({
      query: (setId) => ({ url: `/tenant/assessment/sets/${setId}/open`, method: "POST" }),
      invalidatesTags: ["Assessment"],
    }),
    closeAssessmentSet: builder.mutation<AssessmentSetOut, string>({
      query: (setId) => ({ url: `/tenant/assessment/sets/${setId}/close`, method: "POST" }),
      invalidatesTags: ["Assessment"],
    }),
    updateAssessmentSet: builder.mutation<
      AssessmentSetOut,
      { setId: string; body: Record<string, unknown> }
    >({
      query: ({ setId, body }) => ({
        url: `/tenant/assessment/sets/${setId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Assessment"],
    }),
    deleteAssessmentSet: builder.mutation<void, string>({
      query: (setId) => ({ url: `/tenant/assessment/sets/${setId}`, method: "DELETE" }),
      invalidatesTags: ["Assessment"],
    }),
    assessmentCaConfig: builder.query<TermCaConfigOut, { termId?: string } | void>({
      query: (args) => {
        const qs = args?.termId ? `?term_id=${args.termId}` : "";
        return `/tenant/assessment/ca-config${qs}`;
      },
      providesTags: ["Assessment"],
    }),
    updateAssessmentCaConfig: builder.mutation<
      TermCaConfigOut,
      { termId?: string; body: { method: string; notes?: string; inclusions: { set_id: string; weight: number; sort_order: number }[] } }
    >({
      query: ({ termId, body }) => {
        const qs = termId ? `?term_id=${termId}` : "";
        return { url: `/tenant/assessment/ca-config${qs}`, method: "PUT", body };
      },
      invalidatesTags: ["Assessment"],
    }),
    markEntryRoster: builder.query<
      MarkEntryRosterOut,
      { setId: string; classId: string; subjectId: string; streamId?: string }
    >({
      query: ({ setId, classId, subjectId, streamId }) => {
        const p = new URLSearchParams({
          set_id: setId,
          class_id: classId,
          subject_id: subjectId,
        });
        if (streamId) p.set("stream_id", streamId);
        return `/tenant/assessment/entry/roster?${p.toString()}`;
      },
      providesTags: ["Assessment"],
    }),
    saveAssessmentMarks: builder.mutation<
      { saved: number },
      {
        set_id: string;
        class_id: string;
        subject_id: string;
        stream_id?: string;
        marks: { student_id: string; score?: number | null; competence_level?: string | null; remark?: string | null }[];
      }
    >({
      query: (body) => ({ url: "/tenant/assessment/entry/marks", method: "PUT", body }),
      invalidatesTags: ["Assessment", "ReportCards"],
    }),
    computedCa: builder.query<
      ComputedCaOut,
      { classId: string; streamId?: string; termId?: string }
    >({
      query: ({ classId, streamId, termId }) => {
        const p = new URLSearchParams({ class_id: classId });
        if (streamId) p.set("stream_id", streamId);
        if (termId) p.set("term_id", termId);
        return `/tenant/assessment/computed-ca?${p.toString()}`;
      },
      providesTags: ["Assessment"],
    }),
    assessmentMarksGrid: builder.query<
      MarksGridOut,
      { setId: string; classId: string; streamId?: string; termId?: string }
    >({
      query: ({ setId, classId, streamId, termId }) => {
        const p = new URLSearchParams({ set_id: setId, class_id: classId });
        if (streamId) p.set("stream_id", streamId);
        if (termId) p.set("term_id", termId);
        return `/tenant/assessment/marks-grid?${p.toString()}`;
      },
      providesTags: ["Assessment"],
    }),
    importAssessmentMarks: builder.mutation<MarksImportResponse, MarksImportRequest>({
      query: (body) => ({
        url: "/tenant/assessment/entry/import",
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, arg) =>
        arg.dry_run ? [] : ["Assessment", "ReportCards"],
    }),
    studentPerformance: builder.query<
      StudentPerformanceOut,
      { studentId: string; termId?: string }
    >({
      query: ({ studentId, termId }) => {
        const p = new URLSearchParams({ student_id: studentId });
        if (termId) p.set("term_id", termId);
        return `/tenant/assessment/student-performance?${p.toString()}`;
      },
      providesTags: ["Assessment"],
    }),

    // --- Boarding & Hostel add-on ---
    listHostels: builder.query<HostelOut[], void>({
      query: () => "/tenant/hostels",
      providesTags: ["Hostel"],
    }),
    hostelOptions: builder.query<HostelOption[], { gender?: string } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params && params.gender) p.set("gender", params.gender);
        const qs = p.toString();
        return `/tenant/hostels/options${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Hostel"],
    }),
    getHostel: builder.query<HostelDetailOut, string>({
      query: (hostelId) => `/tenant/hostels/${hostelId}`,
      providesTags: ["Hostel"],
    }),
    createHostel: builder.mutation<HostelOut, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/hostels", method: "POST", body }),
      invalidatesTags: ["Hostel"],
    }),
    updateHostel: builder.mutation<
      HostelOut,
      { hostelId: string; body: Record<string, unknown> }
    >({
      query: ({ hostelId, body }) => ({
        url: `/tenant/hostels/${hostelId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Hostel"],
    }),
    deleteHostel: builder.mutation<void, string>({
      query: (hostelId) => ({ url: `/tenant/hostels/${hostelId}`, method: "DELETE" }),
      invalidatesTags: ["Hostel"],
    }),
    createHostelRoom: builder.mutation<
      HostelRoomOut,
      { hostelId: string; body: Record<string, unknown> }
    >({
      query: ({ hostelId, body }) => ({
        url: `/tenant/hostels/${hostelId}/rooms`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Hostel"],
    }),
    updateHostelRoom: builder.mutation<
      HostelRoomOut,
      { hostelId: string; roomId: string; body: Record<string, unknown> }
    >({
      query: ({ hostelId, roomId, body }) => ({
        url: `/tenant/hostels/${hostelId}/rooms/${roomId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Hostel"],
    }),
    deleteHostelRoom: builder.mutation<void, { hostelId: string; roomId: string }>({
      query: ({ hostelId, roomId }) => ({
        url: `/tenant/hostels/${hostelId}/rooms/${roomId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Hostel"],
    }),
    allocateHostel: builder.mutation<
      HostelDetailOut,
      { student_id: string; hostel_id: string; hostel_room_id?: string | null }
    >({
      query: (body) => ({ url: "/tenant/hostels/allocate", method: "POST", body }),
      invalidatesTags: ["Hostel", "Students"],
    }),
    checkoutHostel: builder.mutation<void, { student_id: string }>({
      query: (body) => ({ url: "/tenant/hostels/checkout", method: "POST", body }),
      invalidatesTags: ["Hostel", "Students"],
    }),
  }),
});

export const {
  usePlatformLoginMutation,
  useTenantLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useChangePasswordMutation,
  useChangePlatformPasswordMutation,
  useListSchoolsQuery,
  useSuggestSchoolCodeQuery,
  useOnboardSchoolMutation,
  useGetSchoolQuery,
  useUpdateSchoolMutation,
  useReplaceModulesMutation,
  useListSchoolUsersQuery,
  useResetPlatformUserPasswordMutation,
  useResetPlatformAdminCredentialsMutation,
  useUploadPlatformSchoolBadgeMutation,
  useDeletePlatformSchoolBadgeMutation,
  useModuleCatalogQuery,
  useDistrictsQuery,
  useEstimateMutation,
  useRequestLogsQuery,
  useErrorLogsQuery,
  useAuditLogsQuery,
  useAuditLogFilesQuery,
  useListPlatformAdminsQuery,
  useCreatePlatformAdminMutation,
  useUpdatePlatformAdminMutation,
  useDeletePlatformAdminMutation,
  useResetPlatformAdminPasswordMutation,
  useResetPlatformDataMutation,
  useGetTenantSchoolQuery,
  useUpdateTenantSchoolMutation,
  useUploadTenantSchoolBadgeMutation,
  useDeleteTenantSchoolBadgeMutation,
  useTenantModuleCatalogQuery,
  useGetTenantModulesQuery,
  useAcademicContextQuery,
  useListAcademicYearsQuery,
  useCreateAcademicYearMutation,
  useUpdateAcademicYearMutation,
  useActivateAcademicYearMutation,
  useUpdateTermMutation,
  useActivateTermMutation,
  useListTermCalendarEventsQuery,
  useCreateTermCalendarEventMutation,
  useUpdateTermCalendarEventMutation,
  useDeleteTermCalendarEventMutation,
  useListCircularsQuery,
  useListCircularInboxQuery,
  useCreateCircularMutation,
  useUpdateCircularMutation,
  usePublishCircularMutation,
  useDeleteCircularMutation,
  useUploadCircularAttachmentMutation,
  useDeleteCircularAttachmentMutation,
  useHrPayrollSummaryQuery,
  useListHrEmployeesQuery,
  useUpsertEmployeeProfileMutation,
  useListLeaveTypesQuery,
  useListLeaveRequestsQuery,
  useListMyLeaveRequestsQuery,
  useRequestLeaveMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useListPayrollRunsQuery,
  useGetPayrollRunQuery,
  useCreatePayrollRunMutation,
  useComputePayrollRunMutation,
  useFinalizePayrollRunMutation,
  useListMyPayslipsQuery,
  useListSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
  useListClassesQuery,
  useSetupPrimaryClassesMutation,
  useSetupNurseryClassesMutation,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
  useCreateStreamMutation,
  useUpdateStreamMutation,
  useDeleteStreamMutation,
  useListTenantRolesQuery,
  useListTenantUsersQuery,
  useNextLoginIdQuery,
  useCreateTenantUserMutation,
  useUpdateTenantUserMutation,
  useResetTenantUserPasswordMutation,
  useImportTeachersMutation,
  useImportGuardiansMutation,
  useListStudentsQuery,
  useRosterSummaryQuery,
  useGetStudentQuery,
  useGetStudentDetailQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useImportStudentsMutation,
  useBulkAssignStudentsMutation,
  useListGuardiansQuery,
  useAddGuardianMutation,
  useUpdateGuardianMutation,
  useDeleteGuardianMutation,
  useGetStudentHealthQuery,
  useUpsertStudentHealthMutation,
  useListDisciplineSchoolWideQuery,
  useListStudentDisciplineQuery,
  useAddDisciplineMutation,
  useUpdateDisciplineMutation,
  useDeleteDisciplineMutation,
  useListTeacherStaffQuery,
  useListTeacherAssignmentsQuery,
  useCreateTeacherAssignmentMutation,
  useDeleteTeacherAssignmentMutation,
  useUpdateTeacherAssignmentMutation,
  useAttendanceSummaryQuery,
  useAttendanceRollQuery,
  useAttendanceClassDayQuery,
  useMarkAttendanceMutation,
  useListTimetableSlotsQuery,
  useTimetableMyDayQuery,
  useCreateTimetableSlotMutation,
  useUpdateTimetableSlotMutation,
  useDeleteTimetableSlotMutation,
  useImportTimetableMutation,
  useGetRegistrationConfigQuery,
  useCreateRegistrationSectionMutation,
  useUpdateRegistrationSectionMutation,
  useDeleteRegistrationSectionMutation,
  useReorderRegistrationSectionsMutation,
  useCreateRegistrationRequirementMutation,
  useUpdateRegistrationRequirementMutation,
  useDeleteRegistrationRequirementMutation,
  useRegistrationSummaryQuery,
  useRegisteredRosterSummaryQuery,
  useRegisteredRosterQuery,
  useRegistrationQueueQuery,
  useGetRegistrationQuery,
  useStartRegistrationMutation,
  useUpsertRegistrationResponsesMutation,
  useCompleteRegistrationMutation,
  useListAdmissionApplicationsQuery,
  useGetAdmissionApplicationQuery,
  useCreateAdmissionApplicationMutation,
  useBatchCreateAdmissionApplicationsMutation,
  useUpdateAdmissionApplicationMutation,
  useLinkAdmissionEnrollmentMutation,
  useReportCardClassesQuery,
  useReportCardStudentsQuery,
  useReportCardPreviewQuery,
  useLazyReportCardPreviewQuery,
  usePleSummaryQuery,
  usePleCandidatesQuery,
  usePleEligibleQuery,
  useNominatePleCandidatesMutation,
  useUpdatePleCandidateMutation,
  useGetGradingConfigQuery,
  useCreateGradingScaleMutation,
  useUpdateGradingScaleMutation,
  useDeleteGradingScaleMutation,
  useCreateScaleGradeRangeMutation,
  useUpdateScaleGradeRangeMutation,
  useDeleteScaleGradeRangeMutation,
  useAssignSubjectGradingScaleMutation,
  useCreateAggregateDivisionMutation,
  useUpdateAggregateDivisionMutation,
  useDeleteAggregateDivisionMutation,
  useFinanceSummaryQuery,
  useFeeStructuresQuery,
  useCreateFeeStructureMutation,
  useActivateFeeStructureMutation,
  useAddFeeStructureLineMutation,
  useDeleteFeeStructureLineMutation,
  useUpdateFeeStructureMutation,
  useUpdateFeeStructureLineMutation,
  useFeeInvoicesQuery,
  useFeeInvoiceDetailQuery,
  useGenerateFeeInvoicesMutation,
  useRecordFeePaymentMutation,
  useAssessmentSummaryQuery,
  useAssessmentSetsQuery,
  useCreateAssessmentSetMutation,
  useOpenAssessmentSetMutation,
  useCloseAssessmentSetMutation,
  useUpdateAssessmentSetMutation,
  useDeleteAssessmentSetMutation,
  useAssessmentCaConfigQuery,
  useUpdateAssessmentCaConfigMutation,
  useMarkEntryRosterQuery,
  useSaveAssessmentMarksMutation,
  useComputedCaQuery,
  useAssessmentMarksGridQuery,
  useImportAssessmentMarksMutation,
  useStudentPerformanceQuery,
  useListHostelsQuery,
  useHostelOptionsQuery,
  useGetHostelQuery,
  useCreateHostelMutation,
  useUpdateHostelMutation,
  useDeleteHostelMutation,
  useCreateHostelRoomMutation,
  useUpdateHostelRoomMutation,
  useDeleteHostelRoomMutation,
  useAllocateHostelMutation,
  useCheckoutHostelMutation,
} = skulpulseApi;
