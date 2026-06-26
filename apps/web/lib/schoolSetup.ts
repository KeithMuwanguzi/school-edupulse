import type {
  ClassOut,
  FinanceSummaryOut,
  GradingConfigOut,
  PortalUser,
  RegistrationConfigOut,
  RosterSummaryOut,
  SchoolDetail,
  AcademicContext,
} from "@/lib/types";

export type SetupTier = "mandatory" | "optional";

export interface SetupStepDefinition {
  id: string;
  tier: SetupTier;
  title: string;
  description: string;
  href: string;
  icon: string;
  /** If set, step only appears when the school subscribes to this module. */
  requiresModule?: string;
  /** If set, step appears when any listed module is subscribed. */
  requiresAnyModule?: string[];
}

export interface SetupStepState extends SetupStepDefinition {
  applicable: boolean;
  done: boolean;
  skipped: boolean;
  resolved: boolean;
}

export interface SetupEvaluation {
  steps: SetupStepState[];
  mandatory: SetupStepState[];
  optional: SetupStepState[];
  mandatoryDone: number;
  mandatoryTotal: number;
  optionalResolved: number;
  optionalTotal: number;
  totalResolved: number;
  totalApplicable: number;
  isComplete: boolean;
  nextStep: SetupStepState | null;
}

export const SETUP_STEPS: SetupStepDefinition[] = [
  {
    id: "profile",
    tier: "mandatory",
    title: "School identity",
    description: "Confirm your school name, head teacher, and contact phone.",
    href: "/app/settings/profile",
    icon: "building2",
  },
  {
    id: "academic",
    tier: "mandatory",
    title: "Academic year & term",
    description: "Verify the active year and term dates match your calendar.",
    href: "/app/settings/academic-year",
    icon: "calendar",
  },
  {
    id: "classes",
    tier: "mandatory",
    title: "Classes",
    description: "Create the classes you teach this year — nursery, primary, or both.",
    href: "/app/m/academics",
    icon: "grid",
  },
  {
    id: "subjects",
    tier: "mandatory",
    title: "Subjects",
    description: "Add the subjects on your curriculum before marks or reports.",
    href: "/app/settings/subjects",
    icon: "book",
  },
  {
    id: "staff",
    tier: "mandatory",
    title: "Staff accounts",
    description: "Invite teachers and bursars so work is not stuck on one login.",
    href: "/app/settings/users",
    icon: "users",
  },
  {
    id: "streams",
    tier: "optional",
    title: "Class streams",
    description: "Split P1–P7 (or nursery) into A/B streams before bulk pupil import.",
    href: "/app/m/academics",
    icon: "grid",
  },
  {
    id: "branding",
    tier: "optional",
    title: "School badge",
    description: "Upload your crest for report cards, receipts, and the portal header.",
    href: "/app/settings/profile",
    icon: "building",
  },
  {
    id: "grading",
    tier: "optional",
    title: "Grading scales",
    description: "Review grade boundaries for each cycle before assessments go live.",
    href: "/app/settings/grading",
    icon: "percent",
    requiresAnyModule: ["assessment", "reportcards"],
  },
  {
    id: "term-registration",
    tier: "optional",
    title: "Term registration checklist",
    description: "Define what pupils must bring or complete each term.",
    href: "/app/settings/term-registration",
    icon: "clipboard",
    requiresModule: "students",
  },
  {
    id: "pupils",
    tier: "optional",
    title: "Enrol pupils",
    description: "Add your first learners manually or via CSV import.",
    href: "/app/m/students",
    icon: "graduation",
    requiresModule: "students",
  },
  {
    id: "fees",
    tier: "optional",
    title: "Fee structure",
    description: "Set term fees before invoicing guardians.",
    href: "/app/m/finance",
    icon: "wallet",
    requiresModule: "finance",
  },
];

function storageKey(kind: "skipped" | "celebrated", schoolCode: string): string {
  return `skulpulse-setup-${kind}:${schoolCode}`;
}

export function readSkippedStepIds(schoolCode: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey("skipped", schoolCode));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function writeSkippedStepIds(schoolCode: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey("skipped", schoolCode), JSON.stringify([...ids]));
}

export function skipSetupStep(schoolCode: string, stepId: string): Set<string> {
  const next = readSkippedStepIds(schoolCode);
  next.add(stepId);
  writeSkippedStepIds(schoolCode, next);
  return next;
}

export function skipAllOptionalSteps(schoolCode: string, stepIds: string[]): Set<string> {
  const next = readSkippedStepIds(schoolCode);
  for (const id of stepIds) next.add(id);
  writeSkippedStepIds(schoolCode, next);
  return next;
}

export function hasCelebratedSetup(schoolCode: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(storageKey("celebrated", schoolCode)) === "1";
}

export function markSetupCelebrated(schoolCode: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey("celebrated", schoolCode), "1");
}

export function workingModeKey(schoolCode: string): string {
  return `skulpulse-setup-working:${schoolCode}`;
}

export function isSetupWorkingMode(schoolCode: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(workingModeKey(schoolCode)) === "1";
}

export function setSetupWorkingMode(schoolCode: string, on: boolean): void {
  if (typeof window === "undefined") return;
  if (on) sessionStorage.setItem(workingModeKey(schoolCode), "1");
  else sessionStorage.removeItem(workingModeKey(schoolCode));
}

function hasModule(modules: string[], key?: string, anyOf?: string[]): boolean {
  if (key) return modules.includes(key);
  if (anyOf) return anyOf.some((m) => modules.includes(m));
  return true;
}

function profileComplete(school: SchoolDetail | undefined): boolean {
  const p = school?.profile;
  if (!p?.name?.trim()) return false;
  if (!p.head_teacher_name?.trim()) return false;
  if (!p.phone?.trim()) return false;
  return true;
}

function staffComplete(users: PortalUser[] | undefined): boolean {
  if (!users?.length) return false;
  const nonAdmin = users.filter((u) => u.role !== "school_admin");
  return nonAdmin.length > 0;
}

function streamsComplete(classes: ClassOut[] | undefined): boolean {
  if (!classes?.length) return false;
  return classes.every((c) => c.streams.length > 0);
}

function gradingComplete(config: GradingConfigOut | undefined): boolean {
  if (!config?.sections?.length) return false;
  return config.sections.some((s) =>
    s.scales.some((scale) => scale.ranges.length > 0),
  );
}

function registrationComplete(config: RegistrationConfigOut | undefined): boolean {
  if (!config?.sections?.length) return false;
  return config.sections.some((s) => s.requirements.length > 0);
}

function feesComplete(
  summary: FinanceSummaryOut | undefined,
  structureCount: number,
): boolean {
  if (structureCount > 0) return true;
  return Boolean(summary?.active_structure_id);
}

const COMPLETION: Record<
  string,
  (ctx: {
    school?: SchoolDetail;
    academic?: AcademicContext;
    classes?: ClassOut[];
    subjects?: unknown[];
    users?: PortalUser[];
    roster?: RosterSummaryOut;
    grading?: GradingConfigOut;
    registration?: RegistrationConfigOut;
    financeSummary?: FinanceSummaryOut;
    feeStructureCount: number;
  }) => boolean
> = {
  profile: ({ school }) => profileComplete(school),
  academic: ({ academic }) => Boolean(academic?.active_term && academic?.academic_year),
  classes: ({ classes }) => (classes?.length ?? 0) > 0,
  subjects: ({ subjects }) => (subjects?.length ?? 0) > 0,
  staff: ({ users }) => staffComplete(users),
  streams: ({ classes }) => streamsComplete(classes),
  branding: ({ school }) => Boolean(school?.profile.badge_url),
  grading: ({ grading }) => gradingComplete(grading),
  "term-registration": ({ registration }) => registrationComplete(registration),
  pupils: ({ roster }) => (roster?.total ?? 0) > 0,
  fees: ({ financeSummary, feeStructureCount }) => feesComplete(financeSummary, feeStructureCount),
};

export function evaluateSchoolSetup(input: {
  modules: string[];
  skippedIds: Set<string>;
  school?: SchoolDetail;
  academic?: AcademicContext;
  classes?: ClassOut[];
  subjects?: unknown[];
  users?: PortalUser[];
  roster?: RosterSummaryOut;
  grading?: GradingConfigOut;
  registration?: RegistrationConfigOut;
  financeSummary?: FinanceSummaryOut;
  feeStructureCount?: number;
}): SetupEvaluation {
  const feeStructureCount = input.feeStructureCount ?? 0;
  const ctx = { ...input, feeStructureCount };

  const steps: SetupStepState[] = SETUP_STEPS.map((def) => {
    const applicable = hasModule(input.modules, def.requiresModule, def.requiresAnyModule);
    const done = applicable ? (COMPLETION[def.id]?.(ctx) ?? false) : false;
    const skipped = applicable && def.tier === "optional" && input.skippedIds.has(def.id);
    const resolved = !applicable || done || skipped;
    return { ...def, applicable, done, skipped, resolved };
  });

  const applicableSteps = steps.filter((s) => s.applicable);
  const mandatory = applicableSteps.filter((s) => s.tier === "mandatory");
  const optional = applicableSteps.filter((s) => s.tier === "optional");

  const mandatoryDone = mandatory.filter((s) => s.done).length;
  const optionalResolved = optional.filter((s) => s.resolved).length;

  const totalResolved = applicableSteps.filter((s) => s.resolved).length;
  const isComplete = applicableSteps.length > 0 && totalResolved === applicableSteps.length;
  const nextStep = applicableSteps.find((s) => !s.resolved) ?? null;

  return {
    steps,
    mandatory,
    optional,
    mandatoryDone,
    mandatoryTotal: mandatory.length,
    optionalResolved,
    optionalTotal: optional.length,
    totalResolved,
    totalApplicable: applicableSteps.length,
    isComplete,
    nextStep,
  };
}

/** Dashboard-friendly subset — mandatory steps only. */
export function dashboardChecklist(evaluation: SetupEvaluation): SetupStepState[] {
  return evaluation.mandatory;
}
