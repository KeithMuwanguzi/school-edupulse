export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const RESIDENCE_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "boarder", label: "Boarder" },
];

export const STATUS_OPTIONS = [
  { value: "enrolled", label: "Enrolled" },
  { value: "transferred", label: "Transferred" },
  { value: "graduated", label: "Graduated" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "suspended", label: "Suspended" },
];

export const RELATIONSHIP_OPTIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling", label: "Sibling" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "other", label: "Other" },
];

export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Learner name fields — Uganda school forms list surname first. */
export const STUDENT_NAME_LABELS = {
  last_name: "Surname",
  middle_name: "Middle name",
  first_name: "Last name",
} as const;

export const STUDENT_NAME_FIELD_ORDER = ["last_name", "middle_name", "first_name"] as const;

export type StudentNameFieldKey = (typeof STUDENT_NAME_FIELD_ORDER)[number];

export function studentNameRequiredMessage(entity = "learner"): string {
  return `Enter the ${entity}'s surname and last name.`;
}

export interface OnboardingGuardianDraft {
  relationship: string;
  full_name: string;
  phone_primary: string;
  is_primary: boolean;
}

export interface OnboardingValidationInput {
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  nationality: string;
  classId: string;
  streamId: string;
  streamCount: number;
  residence: string;
  admissionDate: string;
  homeAddress: string;
  village: string;
  district: string;
  guardians: OnboardingGuardianDraft[];
  bloodGroup: string;
}

export function validateOnboardingStep(step: number, input: OnboardingValidationInput): string | null {
  if (step === 0) {
    if (!input.lastName.trim() || !input.firstName.trim()) {
      return studentNameRequiredMessage();
    }
    if (!input.gender) return "Select gender.";
    if (!input.dob) return "Enter date of birth.";
    if (!input.nationality.trim()) return "Enter nationality.";
  }
  if (step === 1) {
    if (!input.classId) return "Select a class.";
    if (input.streamCount > 0 && !input.streamId) return "Select a stream.";
    if (!input.residence) return "Select day or boarder residence.";
    if (!input.admissionDate) return "Enter admission date.";
    if (!input.homeAddress.trim() && !input.village.trim()) {
      return "Enter a home address or village.";
    }
    if (isUgandanNationality(input.nationality) && !input.district.trim()) {
      return "Select district for Ugandan nationals.";
    }
  }
  if (step === 2) {
    const primary = input.guardians.find((g) => g.is_primary);
    if (!primary?.full_name.trim()) return "Enter the primary guardian's full name.";
    if (!primary?.phone_primary.trim()) return "Enter the primary guardian's phone number.";
  }
  if (step === 3) {
    if (!input.bloodGroup) return "Select blood group.";
  }
  return null;
}

export function formatStudentFullName(parts: {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}): string {
  return [parts.last_name, parts.middle_name, parts.first_name]
    .filter((part) => part && String(part).trim())
    .join(" ");
}

/** Alphabetical order: surname, middle name, last name (given name). */
export function compareStudentFullName(
  a: { first_name: string; middle_name?: string | null; last_name: string },
  b: { first_name: string; middle_name?: string | null; last_name: string },
): number {
  for (const field of ["last_name", "middle_name", "first_name"] as const) {
    const av = (a[field] ?? "").trim();
    const bv = (b[field] ?? "").trim();
    const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export const OTHER_VALUE = "__other__";

export const NATIONALITY_OPTIONS = [
  "Ugandan",
  "Kenyan",
  "Tanzanian",
  "Rwandan",
  "Congolese",
  "South Sudanese",
];

export const RELIGION_OPTIONS = [
  "Anglican",
  "Catholic",
  "Muslim",
  "Seventh-day Adventist",
  "Born Again",
  "Orthodox",
  "Traditional",
  "None",
];

export function isUgandanNationality(nationality?: string | null): boolean {
  return nationality?.trim().toLowerCase() === "ugandan";
}

export function splitSelectOther(
  value: string,
  options: readonly string[],
): { select: string; other: string } {
  const trimmed = value.trim();
  if (!trimmed) return { select: "", other: "" };
  const match = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  if (match) return { select: match, other: "" };
  return { select: OTHER_VALUE, other: trimmed };
}

export const DISCIPLINE_CATEGORY_OPTIONS = [
  { value: "punctuality", label: "Punctuality" },
  { value: "uniform", label: "Uniform" },
  { value: "behavior", label: "Behaviour" },
  { value: "bullying", label: "Bullying" },
  { value: "property_damage", label: "Property damage" },
  { value: "academic_dishonesty", label: "Academic dishonesty" },
  { value: "absenteeism", label: "Absenteeism" },
  { value: "other", label: "Other" },
];

export const SEVERITY_OPTIONS = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
];

export const DISCIPLINE_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "escalated", label: "Escalated" },
];

export function titleCase(value?: string | null): string {
  if (!value) return "";
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function severityTone(severity?: string | null): string {
  switch (severity) {
    case "major":
      return "bg-red-50 text-red-700 ring-red-200";
    case "moderate":
      return "bg-gold-50 text-gold-700 ring-gold-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function disciplineStatusTone(status?: string | null): string {
  switch (status) {
    case "resolved":
      return "bg-brand-50 text-brand-700 ring-brand-200";
    case "escalated":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gold-50 text-gold-700 ring-gold-200";
  }
}
