export const STUDENT_IMPORT_FIELDS = [
  { key: "last_name", label: "Surname", required: true },
  { key: "middle_name", label: "Middle name", required: false },
  { key: "first_name", label: "Last name", required: true },
  { key: "lin", label: "LIN", required: false },
  { key: "class_level", label: "Class (P1–P7)", required: true },
  { key: "stream_name", label: "Stream", required: false },
  { key: "gender", label: "Gender", required: true },
  { key: "date_of_birth", label: "Date of birth", required: true },
  { key: "nationality", label: "Nationality", required: true },
  { key: "religion", label: "Religion", required: false },
  { key: "residence", label: "Residence (day/boarder)", required: true },
  { key: "admission_date", label: "Admission date", required: true },
  { key: "previous_school", label: "Previous school", required: false },
  { key: "home_address", label: "Home address", required: false },
  { key: "village", label: "Village", required: false },
  { key: "district", label: "District", required: false },
  { key: "guardian_name", label: "Guardian name", required: true },
  { key: "guardian_relationship", label: "Guardian relationship", required: false },
  { key: "guardian_phone", label: "Guardian phone", required: true },
  { key: "guardian_email", label: "Guardian email", required: false },
  { key: "blood_group", label: "Blood group", required: true },
  { key: "allergies", label: "Allergies", required: false },
  { key: "medical_conditions", label: "Medical conditions", required: false },
] as const;

import { isUgandanNationality } from "./studentOptions";

export type StudentImportFieldKey = (typeof STUDENT_IMPORT_FIELDS)[number]["key"];

export type StudentImportMappedRow = Record<StudentImportFieldKey, string>;

export const STUDENT_IMPORT_TEMPLATE_CSV = `surname,middle_name,given_name,lin,class_level,stream,gender,date_of_birth,nationality,religion,residence,admission_date,previous_school,home_address,village,district,guardian_name,guardian_relationship,guardian_phone,guardian_email,blood_group,allergies,medical_conditions
Okello,James,Kato,,P3,A,male,2015-03-12,Ugandan,Catholic,day,2024-02-05,Little Stars NS,Plot 5 Kira Rd,Kireka,Wakiso,Sarah Nakimera,mother,+256700111222,sarah@example.com,O+,Peanuts,
Namuli,,Amina,UG-LIN-001,P4,,female,2014-08-20,Ugandan,Muslim,boarder,2023-01-30,,Bweyogerere,Bweyogerere,Wakiso,Paul Mukasa,father,+256780222333,,A-,,Asthma`;

const HEADER_ALIASES: Record<StudentImportFieldKey, string[]> = {
  first_name: ["first_name", "first name", "firstname", "given name", "given_name", "last name", "other names"],
  last_name: ["last_name", "surname", "family name"],
  middle_name: ["middle_name", "middle name", "middlename", "other names"],
  lin: ["lin", "learner id", "learner_id"],
  class_level: ["class_level", "class", "class level", "grade", "form"],
  stream_name: ["stream_name", "stream", "section"],
  gender: ["gender", "sex"],
  date_of_birth: ["date_of_birth", "dob", "birth date", "birthdate"],
  nationality: ["nationality", "citizenship"],
  religion: ["religion", "faith"],
  residence: ["residence", "day_boarder", "day/boarder", "boarding", "boarding_status"],
  admission_date: ["admission_date", "admission date", "date admitted", "enrolled"],
  previous_school: ["previous_school", "previous school", "former school", "last school"],
  home_address: ["home_address", "home address", "address", "residential address"],
  village: ["village", "lc1", "parish"],
  district: ["district", "home district"],
  guardian_name: ["guardian_name", "guardian name", "guardian", "parent name", "next of kin"],
  guardian_relationship: ["guardian_relationship", "relationship", "relation"],
  guardian_phone: ["guardian_phone", "guardian phone", "parent phone", "phone", "contact"],
  guardian_email: ["guardian_email", "guardian email", "parent email", "email"],
  blood_group: ["blood_group", "blood group", "blood type"],
  allergies: ["allergies", "allergy"],
  medical_conditions: ["medical_conditions", "medical conditions", "conditions", "chronic"],
};

export function guessColumnMap(headers: string[]): Partial<Record<StudentImportFieldKey, number>> {
  const map: Partial<Record<StudentImportFieldKey, number>> = {};
  const normalized = headers.map((h) => h.trim().toLowerCase());

  for (const field of STUDENT_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field.key] = idx;
  }
  return map;
}

export function rowsToImportPayload(
  rawRows: string[][],
  columnMap: Partial<Record<StudentImportFieldKey, number>>,
): StudentImportMappedRow[] {
  const hasHeader = Object.values(columnMap).some((idx) => idx === 0);
  const start =
    hasHeader && rawRows[0]?.some((c) => /name|class|gender|guardian|email|phone/i.test(c))
      ? 1
      : 0;

  return rawRows.slice(start).flatMap((cells) => {
    const row = {} as StudentImportMappedRow;
    for (const field of STUDENT_IMPORT_FIELDS) {
      const idx = columnMap[field.key];
      row[field.key] = idx !== undefined ? (cells[idx] ?? "").trim() : "";
    }
    if (!row.first_name && !row.last_name) return [];
    return [row];
  });
}

export function mappedRowsToApi(rows: StudentImportMappedRow[]) {
  const clean = (v: string) => v.trim() || undefined;
  return rows.map((row) => ({
    first_name: row.first_name,
    last_name: row.last_name,
    middle_name: clean(row.middle_name),
    lin: clean(row.lin),
    class_level: clean(row.class_level),
    stream_name: clean(row.stream_name),
    gender: clean(row.gender),
    date_of_birth: clean(row.date_of_birth),
    nationality: clean(row.nationality),
    religion: clean(row.religion),
    residence: clean(row.residence),
    admission_date: clean(row.admission_date),
    previous_school: clean(row.previous_school),
    home_address: clean(row.home_address),
    village: clean(row.village),
    district: clean(row.district),
    guardian_name: clean(row.guardian_name),
    guardian_relationship: clean(row.guardian_relationship),
    guardian_phone: clean(row.guardian_phone),
    guardian_email: clean(row.guardian_email),
    blood_group: clean(row.blood_group),
    allergies: clean(row.allergies),
    medical_conditions: clean(row.medical_conditions),
  }));
}

/** Client-side row check — mirrors onboarding required fields (stream rules validated on server). */
export function validateImportRow(row: StudentImportMappedRow): string | null {
  if (!row.last_name.trim() || !row.first_name.trim()) {
    return "Each row needs a surname and last name.";
  }
  if (!row.class_level.trim()) return "Each row needs a class (P1–P7).";
  if (!row.gender.trim()) return "Each row needs gender.";
  if (!row.date_of_birth.trim()) return "Each row needs date of birth.";
  if (!row.nationality.trim()) return "Each row needs nationality.";
  if (!row.residence.trim()) return "Each row needs residence (day or boarder).";
  if (!row.admission_date.trim()) return "Each row needs admission date.";
  if (!row.home_address.trim() && !row.village.trim()) {
    return "Each row needs a home address or village.";
  }
  if (isUgandanNationality(row.nationality) && !row.district.trim()) {
    return "Ugandan nationals need a district on each row.";
  }
  if (!row.guardian_name.trim()) return "Each row needs a guardian name.";
  if (!row.guardian_phone.trim()) return "Each row needs a guardian phone number.";
  if (!row.blood_group.trim()) return "Each row needs a blood group.";
  return null;
}

export function downloadStudentTemplate() {
  const blob = new Blob([STUDENT_IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
