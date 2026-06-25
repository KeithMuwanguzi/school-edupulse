export const ADMISSION_IMPORT_FIELDS = [
  { key: "last_name", label: "Surname", required: true },
  { key: "middle_name", label: "Middle name", required: false },
  { key: "first_name", label: "Last name", required: true },
  { key: "gender", label: "Gender", required: false },
  { key: "date_of_birth", label: "Date of birth", required: false },
  { key: "applied_class_level", label: "Entry class (P1–P7)", required: false },
  { key: "guardian_name", label: "Guardian name", required: false },
  { key: "guardian_phone", label: "Guardian phone", required: false },
  { key: "previous_school", label: "Previous school", required: false },
] as const;

export type AdmissionImportFieldKey = (typeof ADMISSION_IMPORT_FIELDS)[number]["key"];

export type AdmissionImportMappedRow = Record<AdmissionImportFieldKey, string>;

export const ADMISSION_IMPORT_TEMPLATE_CSV = `surname,middle_name,given_name,gender,date_of_birth,entry_class,guardian_name,guardian_phone,previous_school
Okello,James,Kato,male,2015-03-12,P3,Sarah Nakimera,+256700111222,Little Stars NS
Namuli,,Amina,female,2014-08-20,P4,Paul Mukasa,+256780222333,
Mukasa,Peter,Brian,male,2013-11-05,P5,Jane Mukasa,+256701333444,Green Valley PS`;

const HEADER_ALIASES: Record<AdmissionImportFieldKey, string[]> = {
  first_name: ["first_name", "first name", "firstname", "given name", "given_name", "last name", "other names"],
  last_name: ["last_name", "surname", "family name"],
  middle_name: ["middle_name", "middle name", "middlename"],
  gender: ["gender", "sex"],
  date_of_birth: ["date_of_birth", "dob", "birth date", "birthdate"],
  applied_class_level: ["applied_class_level", "entry_class", "entry class", "class", "class level", "grade"],
  guardian_name: ["guardian_name", "guardian name", "guardian", "parent name"],
  guardian_phone: ["guardian_phone", "guardian phone", "parent phone", "phone", "contact"],
  previous_school: ["previous_school", "previous school", "former school", "last school"],
};

export function guessAdmissionColumnMap(
  headers: string[],
): Partial<Record<AdmissionImportFieldKey, number>> {
  const map: Partial<Record<AdmissionImportFieldKey, number>> = {};
  const normalized = headers.map((h) => h.trim().toLowerCase());

  for (const field of ADMISSION_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field.key] = idx;
  }
  return map;
}

export function admissionRowsToPayload(
  rawRows: string[][],
  columnMap: Partial<Record<AdmissionImportFieldKey, number>>,
): AdmissionImportMappedRow[] {
  const hasHeader = Object.values(columnMap).some((idx) => idx === 0);
  const start =
    hasHeader && rawRows[0]?.some((c) => /name|class|gender|guardian|phone/i.test(c))
      ? 1
      : 0;

  return rawRows.slice(start).flatMap((cells) => {
    const row = {} as AdmissionImportMappedRow;
    for (const field of ADMISSION_IMPORT_FIELDS) {
      const idx = columnMap[field.key];
      row[field.key] = idx !== undefined ? (cells[idx] ?? "").trim() : "";
    }
    if (!row.first_name && !row.last_name) return [];
    return [row];
  });
}

export function mappedAdmissionRowsToApi(
  rows: AdmissionImportMappedRow[],
  shared?: {
    applied_class_level?: string;
    applied_class_id?: string;
    applied_stream_id?: string;
    guardian_relationship?: string;
  },
) {
  const clean = (v: string) => v.trim() || undefined;
  return rows.map((row) => ({
    first_name: row.first_name.trim(),
    last_name: row.last_name.trim(),
    middle_name: clean(row.middle_name),
    gender: clean(row.gender),
    date_of_birth: clean(row.date_of_birth),
    applied_class_level: clean(row.applied_class_level) ?? shared?.applied_class_level,
    applied_class_id: shared?.applied_class_id,
    applied_stream_id: shared?.applied_stream_id,
    guardian_name: clean(row.guardian_name),
    guardian_relationship: shared?.guardian_relationship,
    guardian_phone: clean(row.guardian_phone),
    previous_school: clean(row.previous_school),
  }));
}

export function downloadAdmissionTemplate() {
  const blob = new Blob([ADMISSION_IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "admission-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
