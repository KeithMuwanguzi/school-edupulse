// Shared API types (mirror FastAPI schemas — §6).

export type TenantStatus = "trial" | "active" | "suspended" | "inactive";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TenantSummary {
  id: string;
  school_code: string;
  name?: string | null;
  status: string;
}

export interface Me {
  id: string;
  type: "platform_admin" | "tenant_user";
  name: string;
  email?: string | null;
  role: string;
  login_id?: string | null;
  tenant?: TenantSummary | null;
  modules: string[];
}

export interface ModuleCatalogItem {
  id: string;
  module_key: string;
  name: string;
  description?: string | null;
  category: string;
  price_per_term_ugx: number;
  is_active: boolean;
}

export interface InvoiceLine {
  module_key: string;
  name: string;
  price_per_term_ugx: number;
}

export interface InvoiceBreakdown {
  currency: string;
  platform_base_fee_ugx: number;
  modules: InvoiceLine[];
  module_total_ugx: number;
  total_per_term_ugx: number;
}

export interface TenantModules {
  modules: string[];
  invoice: InvoiceBreakdown;
}

export interface SchoolListItem {
  tenant_id: string;
  school_id?: string | null;
  school_code: string;
  name: string;
  status: string;
  ownership?: string | null;
  module_count: number;
  created_at: string;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface SchoolProfile {
  name: string;
  motto?: string | null;
  badge_url?: string | null;
  ownership: string;
  emis_number?: string | null;
  license_number?: string | null;
  registration_status: string;
  boarding_status: string;
  sex_composition: string;
  is_upe: boolean;
  district_id?: string | null;
  county_id?: string | null;
  sub_county_id?: string | null;
  parish_id?: string | null;
  address_line?: string | null;
  phone?: string | null;
  email?: string | null;
  head_teacher_name?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_nin?: string | null;
  timezone: string;
  currency: string;
  locale: string;
  student_number_prefix?: string | null;
  report_footer_notes?: string | null;
  report_next_term_note?: string | null;
  version: number;
}

export interface SchoolDetail {
  tenant_id: string;
  school_id: string;
  school_code: string;
  status: string;
  profile: SchoolProfile;
  modules: string[];
  created_at: string;
}

export interface PortalUser {
  id: string;
  login_id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  email?: string | null;
  /** null = inherits the school's full module set; a list narrows access. */
  allowed_modules?: string[] | null;
  last_login_at?: string | null;
  created_at?: string;
}

export interface RoleOption {
  role_key: string;
  name: string;
  description?: string | null;
}

export interface PasswordResetStubResponse {
  message: string;
  temporary_password: string;
}

export interface ImportRowResult {
  line: number;
  identifier: string;
  status: "created" | "skipped" | "failed" | string;
  username?: string | null;
  temporary_password?: string | null;
  message?: string | null;
}

export interface ImportUsersResponse {
  created: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
}

export interface RequestLogItem {
  request_id: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  tenant_id?: string | null;
  actor_type: string;
  error_code?: string | null;
  created_at: string;
}

export interface ErrorLogItem {
  request_id: string;
  level: string;
  error_type?: string | null;
  error_code?: string | null;
  message: string;
  endpoint?: string | null;
  tenant_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface AcademicYearOut {
  id: string;
  label: string;
  status: string;
  starts_on?: string | null;
  ends_on?: string | null;
}

export interface TermOut {
  id: string;
  term_number: number;
  label: string;
  status: string;
  starts_on?: string | null;
  ends_on?: string | null;
}

export interface AcademicYearWithTerms extends AcademicYearOut {
  terms: TermOut[];
}

export interface AcademicContext {
  academic_year?: AcademicYearOut | null;
  active_term?: TermOut | null;
  terms?: TermOut[];
}

export type NcdcCycle = "cycle_1" | "cycle_2" | "cycle_3";

export interface SubjectOut {
  id: string;
  code: string;
  name: string;
  /** All NCDC cycles this subject is taught in. */
  ncdc_cycles: NcdcCycle[];
  /** Primary cycle (first in sort order) — convenience for legacy UI. */
  ncdc_cycle: NcdcCycle;
  is_active: boolean;
  /** Core subject counted toward the aggregate (e.g. English, Maths, Science, SST). */
  is_core: boolean;
  sort_order: number;
}

export interface StreamOut {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface ClassOut {
  id: string;
  level: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  streams: StreamOut[];
}

export interface GuardianLinkOut {
  user_id: string;
  name: string;
  username: string;
  email?: string | null;
}

export interface StudentOut {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  preferred_name?: string | null;
  lin?: string | null;
  class_id?: string | null;
  class_level?: string | null;
  class_label?: string | null;
  stream_id?: string | null;
  stream_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  religion?: string | null;
  residence?: string | null;
  house?: string | null;
  hostel_id?: string | null;
  hostel_room_id?: string | null;
  hostel_name?: string | null;
  hostel_room_name?: string | null;
  admission_date?: string | null;
  previous_school?: string | null;
  home_address?: string | null;
  village?: string | null;
  district?: string | null;
  photo_url?: string | null;
  status: string;
  is_active: boolean;
  guardian?: GuardianLinkOut | null;
  guardian_count: number;
}

export interface StudentGuardianOut {
  id: string;
  student_id: string;
  relationship: string;
  full_name: string;
  phone_primary?: string | null;
  phone_alt?: string | null;
  email?: string | null;
  occupation?: string | null;
  national_id?: string | null;
  address?: string | null;
  is_primary: boolean;
  is_emergency: boolean;
  can_pickup: boolean;
  portal_user_id?: string | null;
  portal_username?: string | null;
}

export interface StudentHealthOut {
  id: string;
  student_id: string;
  blood_group?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  medications?: string | null;
  disabilities?: string | null;
  dietary_needs?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  emergency_notes?: string | null;
}

export interface StudentDisciplineOut {
  id: string;
  student_id: string;
  incident_date: string;
  category: string;
  severity?: string | null;
  description: string;
  action_taken?: string | null;
  status: string;
  recorded_by_user_id?: string | null;
  recorded_by_name?: string | null;
  created_at: string;
  student_name?: string | null;
  student_number?: string | null;
}

export interface AdmissionApplicationOut {
  id: string;
  reference_number: string;
  status: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  applied_class_level?: string | null;
  applied_class_id?: string | null;
  applied_stream_id?: string | null;
  applied_class_label?: string | null;
  applied_stream_name?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  previous_school?: string | null;
  notes?: string | null;
  interview_date?: string | null;
  interview_score?: number | null;
  applied_at: string;
  student_id?: string | null;
  enrolled_at?: string | null;
  withdrawal_reason?: string | null;
  withdrawal_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionBatchRowResult {
  line: number;
  identifier: string;
  status: string;
  message?: string | null;
  application_id?: string | null;
  reference_number?: string | null;
}

export interface AdmissionBatchResponse {
  created: number;
  failed: number;
  results: AdmissionBatchRowResult[];
}

export interface StudentDetailOut extends StudentOut {
  guardians: StudentGuardianOut[];
  health?: StudentHealthOut | null;
  discipline: StudentDisciplineOut[];
}

// --- Boarding & Hostel add-on ---------------------------------------------

export type HostelGender = "boys" | "girls" | "mixed";

export interface HostelRoomOut {
  id: string;
  hostel_id: string;
  name: string;
  capacity: number;
  floor?: string | null;
  notes?: string | null;
  is_active: boolean;
  sort_order: number;
  occupied: number;
  available: number;
}

export interface HostelOut {
  id: string;
  name: string;
  code?: string | null;
  gender: HostelGender;
  capacity?: number | null;
  warden_user_id?: string | null;
  warden_name?: string | null;
  location?: string | null;
  notes?: string | null;
  is_active: boolean;
  sort_order: number;
  room_count: number;
  effective_capacity?: number | null;
  occupied: number;
  available?: number | null;
  occupancy_pct: number;
}

export interface HostelResidentOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  gender?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
  hostel_room_id?: string | null;
  room_name?: string | null;
}

export interface HostelDetailOut extends HostelOut {
  rooms: HostelRoomOut[];
  residents: HostelResidentOut[];
  unassigned_residents: number;
}

export interface HostelRoomOption {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  available: number;
  is_full: boolean;
}

export interface HostelOption {
  id: string;
  name: string;
  gender: HostelGender;
  effective_capacity?: number | null;
  occupied: number;
  available?: number | null;
  is_full: boolean;
  rooms: HostelRoomOption[];
}

export interface StudentImportRowResult {
  line: number;
  identifier: string;
  status: string;
  message?: string | null;
  student_id?: string | null;
}

export interface StudentImportResponse {
  created: number;
  skipped: number;
  failed: number;
  valid: number;
  results: StudentImportRowResult[];
}

export interface BulkAssignResponse {
  updated: number;
  failed: number;
  results: { student_id: string; status: string; message?: string | null }[];
}

export interface TeacherStaffOut {
  id: string;
  login_id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  assignment_count: number;
}

export interface TeacherAssignmentOut {
  id: string;
  teacher_user_id: string;
  teacher_name: string;
  academic_year_id: string;
  academic_year_label: string;
  term_id?: string | null;
  term_label?: string | null;
  class_id: string;
  class_level: string;
  stream_id?: string | null;
  stream_name?: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  is_class_teacher: boolean;
}

export interface StreamRosterCount {
  stream_id: string;
  name: string;
  count: number;
}

export interface ClassRosterCount {
  class_id: string;
  level: string;
  label: string;
  count: number;
  streams: StreamRosterCount[];
}

export interface RosterSummaryOut {
  total: number;
  unassigned: number;
  classes: ClassRosterCount[];
}

export type RosterScope =
  | { kind: "overview" }
  | { kind: "unassigned" }
  | { kind: "class"; classId: string }
  | { kind: "stream"; classId: string; streamId: string };

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface ClassAttendanceCount {
  class_id: string;
  level: string;
  label: string;
  enrolled: number;
  marked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AttendanceDailySummary {
  date: string;
  academic_year_label: string;
  term_label?: string | null;
  total_enrolled: number;
  total_marked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  chronic_absentees: number;
  classes: ClassAttendanceCount[];
}

export interface AttendanceRollRow {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  status: AttendanceStatus;
  remarks?: string | null;
  saved: boolean;
  term_rate?: number | null;
}

export interface AttendanceRollOut {
  date: string;
  class_id: string;
  class_level: string;
  stream_id?: string | null;
  stream_name?: string | null;
  timetable_slot_id?: string | null;
  rows: AttendanceRollRow[];
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AttendanceMarkResponse {
  date: string;
  saved: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface ClassAttendanceLesson {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  period_label?: string | null;
  room?: string | null;
  enrolled: number;
  recorded: boolean;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface ClassAttendanceDayOut {
  date: string;
  day_of_week: number;
  class_id: string;
  class_label: string;
  class_level: string;
  stream_id?: string | null;
  stream_name?: string | null;
  academic_year_label: string;
  term_label?: string | null;
  lessons: ClassAttendanceLesson[];
}

export interface TimetableSlotOut {
  id: string;
  academic_year_id: string;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  day_of_week: number;
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
  class_id: string;
  class_level: string;
  class_label: string;
  stream_id?: string | null;
  stream_name?: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_user_id: string;
  teacher_name: string;
  period_label?: string | null;
  room?: string | null;
}

export interface TeacherLessonOut extends TimetableSlotOut {
  is_today: boolean;
  has_ended: boolean;
  can_record: boolean;
  recorded: boolean;
  enrolled: number;
}

export interface TeacherDayOut {
  date: string;
  day_of_week: number;
  academic_year_label: string;
  term_label?: string | null;
  lessons: TeacherLessonOut[];
}

export interface TimetableImportRowResult {
  line: number;
  identifier: string;
  status: string;
  message?: string | null;
}

export interface TimetableImportResponse {
  created: number;
  failed: number;
  valid: number;
  results: TimetableImportRowResult[];
}

export interface RegistrationRequirementOut {
  id: string;
  section_id: string;
  slug: string;
  label: string;
  description?: string | null;
  field_type: string;
  is_required: boolean;
  options?: string[] | null;
  sort_order: number;
  is_active: boolean;
}

export interface RegistrationSectionOut {
  id: string;
  slug: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  sort_order: number;
  is_active: boolean;
  requirements: RegistrationRequirementOut[];
}

export interface RegistrationConfigOut {
  sections: RegistrationSectionOut[];
}

export interface RegistrationResponseOut {
  id: string;
  requirement_id: string;
  value?: string | boolean | number | null;
  status: string;
  notes?: string | null;
  recorded_by_name?: string | null;
  recorded_at?: string | null;
}

export interface RegistrationSectionProgressOut {
  section_id: string;
  slug: string;
  label: string;
  icon?: string | null;
  required_total: number;
  required_done: number;
  optional_total: number;
  optional_done: number;
  is_complete: boolean;
  requirements: RegistrationRequirementOut[];
  responses: RegistrationResponseOut[];
}

export interface RegistrationSummaryOut {
  term_id: string;
  term_label: string;
  total_students: number;
  not_started: number;
  in_progress: number;
  complete: number;
}

export interface RegistrationQueueItemOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  class_level?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
  registration_id?: string | null;
  status: string;
  required_total: number;
  required_done: number;
  sections_complete: number;
  sections_total: number;
}

export interface RegistrationDetailOut {
  id: string;
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  term_id: string;
  term_label: string;
  status: string;
  class_level?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
  required_total: number;
  required_done: number;
  sections_complete: number;
  sections_total: number;
  completed_at?: string | null;
  sections: RegistrationSectionProgressOut[];
}

export interface RegisteredStreamSummaryOut {
  stream_id: string;
  name: string;
  count: number;
}

export interface RegisteredClassSummaryOut {
  class_id: string;
  level: string;
  label: string;
  count: number;
  streams: RegisteredStreamSummaryOut[];
}

export interface RegisteredRosterSummaryOut {
  term_id: string;
  term_label: string;
  total_registered: number;
  total_enrolled: number;
  unassigned: number;
  classes: RegisteredClassSummaryOut[];
}

export interface RegisteredStudentOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  class_level?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
  registration_id?: string | null;
  registered_at?: string | null;
}

export interface GradeRangeOut {
  id: string;
  scale_id: string;
  label: string;
  aggregate_weight: number;
  min_mark: number;
  max_mark: number;
  class_teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface GradingScaleOut {
  id: string;
  name: string;
  ncdc_cycle: string;
  description?: string | null;
  sort_order: number;
  ranges: GradeRangeOut[];
  subject_count: number;
}

export interface SubjectGradingOut {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  ncdc_cycles: string[];
  grading_scale_id?: string | null;
  grading_scale_name?: string | null;
}

export interface CycleGradingSectionOut {
  cycle: string;
  cycle_label: string;
  scales: GradingScaleOut[];
  subjects: SubjectGradingOut[];
}

export interface AggregateDivisionOut {
  id: string;
  label: string;
  min_aggregate: number;
  max_aggregate: number;
  class_teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface GradingConfigOut {
  sections: CycleGradingSectionOut[];
  aggregate_divisions: AggregateDivisionOut[];
}

export interface ReportCardSchoolBranding {
  name: string;
  motto?: string | null;
  badge_url?: string | null;
  head_teacher_name?: string | null;
  address_line?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ReportCardStudentOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
}

export interface ReportCardTermOut {
  term_id: string;
  label: string;
  term_number: number;
  academic_year_label: string;
}

export interface ReportCardSetScore {
  set_id: string;
  score?: number | null;
  max_mark: number;
  percentage?: number | null;
  grade?: string | null;
}

export interface ReportCardSubjectLine {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  status: string;
  is_core: boolean;
  competence?: string | null;
  ca_score?: number | null;
  exam_score?: number | null;
  total_score?: number | null;
  grade?: string | null;
  aggregate_points?: number | null;
  remark?: string | null;
  comment?: string | null;
  set_scores: ReportCardSetScore[];
}

export interface ReportCardAssessmentSet {
  set_id: string;
  name: string;
  max_mark: number;
  sort_order: number;
  included_in_ca: boolean;
}

export interface ReportCardGradeKey {
  label: string;
  min_mark: number;
  max_mark: number;
  aggregate_points: number;
}

export interface ReportCardAttendanceOut {
  present_days: number;
  total_days: number;
  percentage: number;
}

export interface ReportCardFooterOut {
  next_term_label?: string | null;
  next_term_starts_on?: string | null;
  next_term_note?: string | null;
  requirements_text?: string | null;
  term_fees_summary?: string | null;
}

export interface ReportCardPreviewOut {
  school: ReportCardSchoolBranding;
  student: ReportCardStudentOut;
  term: ReportCardTermOut;
  assessment_mode: "competency" | "subject_ca" | "ple";
  level_section: string;
  marks_available: boolean;
  assessment_sets: ReportCardAssessmentSet[];
  subject_lines: ReportCardSubjectLine[];
  grading_key: ReportCardGradeKey[];
  footer?: ReportCardFooterOut | null;
  average_score?: number | null;
  aggregate?: number | null;
  total_marks?: number | null;
  total_aggregate?: number | null;
  division_label?: string | null;
  attendance?: ReportCardAttendanceOut | null;
  class_teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  comment_grade_label?: string | null;
  comments_status: "pending_marks" | "resolved" | "no_scale" | "no_band";
  generated_at: string;
}

export interface ReportCardClassOption {
  class_id: string;
  class_label: string;
  level: string;
  registered_count: number;
}

export interface PleReadinessOut {
  term_id?: string | null;
  term_label?: string | null;
  average_score?: number | null;
  aggregate?: number | null;
  division_label?: string | null;
  marks_available: boolean;
}

export interface PleCandidateStudentOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
}

export interface PleCandidateOut {
  id: string;
  student_id: string;
  academic_year_id: string;
  academic_year_label: string;
  status: string;
  candidate_number?: string | null;
  registered_on?: string | null;
  withdrawn_on?: string | null;
  withdrawal_reason?: string | null;
  notes?: string | null;
  student: PleCandidateStudentOut;
  readiness: PleReadinessOut;
}

export interface PleEligibleStudentOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  class_label?: string | null;
  stream_name?: string | null;
  readiness: PleReadinessOut;
}

export interface PleCandidacySummaryOut {
  academic_year_id: string;
  academic_year_label: string;
  term_label?: string | null;
  total_p7_registered: number;
  nominated: number;
  registered: number;
  withdrawn: number;
  completed: number;
  not_nominated: number;
}

export interface FeeStructureLineOut {
  id: string;
  label: string;
  amount_ugx: number;
  applies_to: string;
  class_level?: string | null;
  sort_order: number;
  is_optional: boolean;
}

export interface FeeStructureOut {
  id: string;
  term_id: string;
  term_label: string;
  name: string;
  status: string;
  due_on?: string | null;
  notes?: string | null;
  activated_at?: string | null;
  line_count: number;
  total_ugx: number;
  lines: FeeStructureLineOut[];
}

export interface FeePaymentOut {
  id: string;
  amount_ugx: number;
  method: string;
  reference?: string | null;
  paid_on: string;
  note?: string | null;
  recorded_by_user_id: string;
  created_at: string;
}

export interface FeeInvoiceLineOut {
  id: string;
  label: string;
  amount_ugx: number;
  sort_order: number;
}

export interface FeeInvoiceOut {
  id: string;
  invoice_number: string;
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  class_label?: string | null;
  term_id: string;
  term_label: string;
  total_ugx: number;
  amount_paid_ugx: number;
  balance_ugx: number;
  status: string;
  is_overdue: boolean;
  issued_at: string;
  due_on?: string | null;
}

export interface FeeInvoiceDetailOut extends FeeInvoiceOut {
  structure_id: string;
  structure_name: string;
  lines: FeeInvoiceLineOut[];
  payments: FeePaymentOut[];
}

export interface FinanceSummaryOut {
  term_id: string;
  term_label: string;
  active_structure_id?: string | null;
  active_structure_name?: string | null;
  registered_count: number;
  invoiced_count: number;
  not_invoiced_count: number;
  total_invoiced_ugx: number;
  total_collected_ugx: number;
  total_outstanding_ugx: number;
  counts: Record<string, number>;
}

export interface InvoiceGenerateOut {
  created: number;
  skipped_existing: number;
  refreshed: number;
  term_id: string;
}

export interface AssessmentSetOut {
  id: string;
  term_id: string;
  name: string;
  description?: string | null;
  max_mark: number;
  sort_order: number;
  entry_status: "draft" | "open" | "closed";
  marks_entered: number;
}

export interface CaSetInclusionOut {
  set_id: string;
  weight: number;
  sort_order: number;
  set_name: string;
  entry_status: string;
}

export interface TermCaConfigOut {
  term_id: string;
  method: "average" | "weighted_average";
  notes?: string | null;
  inclusions: CaSetInclusionOut[];
}

export interface AssessmentSummaryOut {
  term_id: string;
  term_label: string;
  total_sets: number;
  open_sets: number;
  closed_sets: number;
  total_marks: number;
  ca_configured: boolean;
}

export interface MarkEntryStudentRow {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  score?: number | null;
  competence_level?: string | null;
  remark?: string | null;
}

export interface MarkEntryRosterOut {
  set_id: string;
  set_name: string;
  max_mark: number;
  entry_status: string;
  term_id: string;
  class_id: string;
  class_label: string;
  class_level: string;
  subject_id: string;
  subject_name: string;
  scoring_mode: "numeric" | "competency";
  can_edit: boolean;
  students: MarkEntryStudentRow[];
}

export interface SubjectCaScoreOut {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  is_core: boolean;
  ca_score?: number | null;
  competence_level?: string | null;
  grade_label?: string | null;
  aggregate_points?: number | null;
  sets_used: number;
  status: "pending" | "computed";
}

export interface StudentCaSummaryOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  subjects: SubjectCaScoreOut[];
  average_score?: number | null;
  aggregate?: number | null;
  division_label?: string | null;
  subjects_scored: number;
}

export interface ComputedCaOut {
  term_id: string;
  class_id: string;
  method: string;
  ca_configured: boolean;
  using_all_recorded_sets: boolean;
  registered_count: number;
  excluded_unregistered: number;
  students: StudentCaSummaryOut[];
}

export interface MarksImportRow {
  student_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  score?: number | null;
  competence_level?: string | null;
  remark?: string | null;
}

export interface MarksImportRequest {
  set_id: string;
  class_id: string;
  subject_id: string;
  stream_id?: string | null;
  rows: MarksImportRow[];
  dry_run?: boolean;
}

export interface MarksImportRowResult {
  line: number;
  identifier: string;
  matched_student_id?: string | null;
  status: "valid" | "imported" | "skipped" | "failed";
  message?: string | null;
  score?: number | null;
}

export interface MarksImportResponse {
  set_id: string;
  subject_id: string;
  imported: number;
  valid: number;
  skipped: number;
  failed: number;
  results: MarksImportRowResult[];
}

export interface PerformanceSetMark {
  set_id: string;
  set_name: string;
  max_mark: number;
  score?: number | null;
  percentage?: number | null;
}

export interface PerformanceSetColumn {
  set_id: string;
  set_name: string;
  max_mark: number;
}

export interface PerformanceSubject {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  is_core: boolean;
  ca_score?: number | null;
  grade_label?: string | null;
  aggregate_points?: number | null;
  status: string;
  set_marks: PerformanceSetMark[];
}

export interface StudentPerformanceOut {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  class_label?: string | null;
  class_level: string;
  term_id: string;
  term_label: string;
  set_columns: PerformanceSetColumn[];
  subjects: PerformanceSubject[];
  average_score?: number | null;
  aggregate?: number | null;
  division_label?: string | null;
  marks_available: boolean;
}

export interface MarksGridSubjectCol {
  subject_id: string;
  subject_code: string;
  subject_name: string;
}

export interface MarksGridCell {
  subject_id: string;
  score?: number | null;
  competence_level?: string | null;
  display: string;
}

export interface MarksGridStudentRow {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  cells: MarksGridCell[];
}

export interface MarksGridOut {
  set_id: string;
  set_name: string;
  max_mark: number;
  class_id: string;
  class_level: string;
  scoring_mode: string;
  subjects: MarksGridSubjectCol[];
  students: MarksGridStudentRow[];
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  request_id?: string;
  module?: string;
  errors?: { field: string; message: string }[];
}
