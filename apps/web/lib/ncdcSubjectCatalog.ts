import type { NcdcCycle } from "@/lib/types";

/** Curated NCDC-aligned subjects for Ugandan nursery (ECD) and primary (P1–P7). */
export interface NcdcSubjectSuggestion {
  code: string;
  name: string;
  cycle: NcdcCycle;
  /** Short note shown in the picker. */
  hint?: string;
  /** UNEB PLE exam subject (P7). */
  ple?: boolean;
  /** Included in “add recommended” bulk action. */
  recommended?: boolean;
}

export const NCDC_CYCLE_LABELS: Record<NcdcCycle, { short: string; title: string; grades: string }> = {
  ecd: {
    short: "Baby–Top",
    title: "Early childhood learning areas",
    grades: "Nursery · ECD",
  },
  cycle_1: {
    short: "P1–P3",
    title: "Thematic learning areas",
    grades: "Lower primary",
  },
  cycle_2: {
    short: "P4",
    title: "Transition year",
    grades: "Primary 4",
  },
  cycle_3: {
    short: "P5–P7",
    title: "Subject-based",
    grades: "Upper primary · PLE",
  },
};

export const NCDC_SUBJECT_CATALOG: NcdcSubjectSuggestion[] = [
  // ECD — Baby, Middle, Top (competence-based learning areas)
  { code: "LANG", name: "Language Development", cycle: "ecd", hint: "Listening, speaking, pre-literacy", recommended: true },
  { code: "NUM", name: "Numeracy", cycle: "ecd", hint: "Counting, shapes, early maths", recommended: true },
  { code: "CA", name: "Creative Arts", cycle: "ecd", hint: "Music, dance, drama, drawing", recommended: true },
  { code: "PE", name: "Physical Development", cycle: "ecd", hint: "Gross and fine motor skills", recommended: true },
  { code: "SEL", name: "Social-Emotional Learning", cycle: "ecd", hint: "Self-awareness and relationships", recommended: true },
  { code: "ENV", name: "Environmental Awareness", cycle: "ecd", hint: "Nature and community", recommended: true },
  { code: "RE", name: "Religious Education", cycle: "ecd" },
  { code: "LL", name: "Local Language", cycle: "ecd", hint: "Mother tongue / local language" },

  // Cycle 1 — P1–P3 (report-card subjects + NCDC thematic learning areas)
  { code: "ENG", name: "English", cycle: "cycle_1", recommended: true },
  { code: "MATH", name: "Mathematics", cycle: "cycle_1", recommended: true },
  { code: "LIT1", name: "Literacy 1", cycle: "cycle_1", recommended: true },
  { code: "LIT2", name: "Literacy 2", cycle: "cycle_1", recommended: true },
  { code: "READ", name: "Reading", cycle: "cycle_1", recommended: true },
  { code: "RE", name: "Religious Education", cycle: "cycle_1", recommended: true },
  { code: "LIT", name: "Literacy", cycle: "cycle_1", hint: "Integrated literacy (NCDC thematic)" },
  { code: "NUM", name: "Numeracy", cycle: "cycle_1", hint: "Numbers and early maths (NCDC thematic)" },
  { code: "LIFE", name: "Life Skills", cycle: "cycle_1", hint: "Personal, social, and health education" },
  { code: "CA", name: "Creative Arts", cycle: "cycle_1", hint: "Music, dance, drama, and art" },
  { code: "PE", name: "Physical Education", cycle: "cycle_1" },
  { code: "SCI", name: "Science", cycle: "cycle_1" },
  { code: "SST", name: "Social Studies", cycle: "cycle_1" },
  { code: "LL", name: "Local Language", cycle: "cycle_1", hint: "Luganda, Runyankore, Ateso, etc." },
  { code: "ENV", name: "Environmental Studies", cycle: "cycle_1", hint: "Our surroundings and nature" },

  // Cycle 2 — P4 transition
  { code: "ENG", name: "English", cycle: "cycle_2", recommended: true },
  { code: "MATH", name: "Mathematics", cycle: "cycle_2", recommended: true },
  { code: "SCI", name: "Science", cycle: "cycle_2", recommended: true },
  { code: "SST", name: "Social Studies", cycle: "cycle_2", recommended: true },
  { code: "RE", name: "Religious Education", cycle: "cycle_2", recommended: true },
  { code: "LL", name: "Local Language", cycle: "cycle_2" },
  { code: "CA", name: "Creative Arts", cycle: "cycle_2" },
  { code: "PE", name: "Physical Education", cycle: "cycle_2" },
  { code: "LIFE", name: "Life Skills", cycle: "cycle_2" },

  // Cycle 3 — P5–P7 subject-based (PLE)
  { code: "ENG", name: "English", cycle: "cycle_3", ple: true, recommended: true },
  { code: "MATH", name: "Mathematics", cycle: "cycle_3", ple: true, recommended: true },
  { code: "SCI", name: "Science", cycle: "cycle_3", ple: true, recommended: true },
  { code: "SST", name: "Social Studies", cycle: "cycle_3", ple: true, hint: "Includes RE content for PLE", recommended: true },
  { code: "RE", name: "Religious Education", cycle: "cycle_3" },
  { code: "LL", name: "Local Language", cycle: "cycle_3" },
  { code: "CA", name: "Creative Arts", cycle: "cycle_3" },
  { code: "PE", name: "Physical Education", cycle: "cycle_3" },
  { code: "ICT", name: "Computer Studies", cycle: "cycle_3", hint: "Digital literacy" },
  { code: "AGR", name: "Agriculture", cycle: "cycle_3" },
  { code: "LIT", name: "Literature", cycle: "cycle_3" },
];

const PRIMARY_CYCLES: NcdcCycle[] = ["cycle_1", "cycle_2", "cycle_3"];

function catalogSort(a: NcdcSubjectSuggestion, b: NcdcSubjectSuggestion): number {
  const ar = a.recommended ? 0 : 1;
  const br = b.recommended ? 0 : 1;
  if (ar !== br) return ar - br;
  return a.code.localeCompare(b.code);
}

/** Merge cycle-specific entries with sibling primary cycles so ENG, SST, etc. appear in every primary picker. */
function mergePrimaryCatalog(targetCycle: NcdcCycle): NcdcSubjectSuggestion[] {
  const byCode = new Map<string, NcdcSubjectSuggestion>();

  for (const item of NCDC_SUBJECT_CATALOG.filter((s) => s.cycle === targetCycle)) {
    byCode.set(item.code, item);
  }

  for (const sourceCycle of PRIMARY_CYCLES) {
    if (sourceCycle === targetCycle) continue;
    for (const item of NCDC_SUBJECT_CATALOG.filter((s) => s.cycle === sourceCycle)) {
      if (byCode.has(item.code)) continue;
      byCode.set(item.code, {
        ...item,
        cycle: targetCycle,
        recommended: false,
        hint: item.hint ?? `Also taught in ${NCDC_CYCLE_LABELS[sourceCycle].short}`,
      });
    }
  }

  return Array.from(byCode.values()).sort(catalogSort);
}

export function catalogForCycle(cycle: NcdcCycle): NcdcSubjectSuggestion[] {
  if (cycle === "ecd") {
    return NCDC_SUBJECT_CATALOG.filter((s) => s.cycle === "ecd");
  }
  if (PRIMARY_CYCLES.includes(cycle)) {
    return mergePrimaryCatalog(cycle);
  }
  return NCDC_SUBJECT_CATALOG.filter((s) => s.cycle === cycle);
}

export function recommendedForCycle(cycle: NcdcCycle): NcdcSubjectSuggestion[] {
  return catalogForCycle(cycle).filter((s) => s.recommended);
}

export function searchCatalog(
  cycle: NcdcCycle,
  query: string,
  existingCodes: Set<string>,
): { available: NcdcSubjectSuggestion[]; taken: NcdcSubjectSuggestion[] } {
  const q = query.trim().toLowerCase();
  const items = catalogForCycle(cycle).filter(
    (s) =>
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.hint?.toLowerCase().includes(q),
  );
  const available: NcdcSubjectSuggestion[] = [];
  const taken: NcdcSubjectSuggestion[] = [];
  for (const item of items) {
    if (existingCodes.has(item.code.toUpperCase())) taken.push(item);
    else available.push(item);
  }
  return { available, taken };
}

export function findCatalogEntry(
  cycle: NcdcCycle,
  code: string,
): NcdcSubjectSuggestion | undefined {
  const c = code.trim().toUpperCase();
  return catalogForCycle(cycle).find((s) => s.code === c);
}

/** Lower-primary report-card core — typical P1–P3 subjects. */
export const PRIMARY_P1_P3_DEFAULTS: PrimaryCoreDefault[] = [
  { code: "ENG", name: "English", cycles: ["cycle_1"] },
  { code: "MATH", name: "Mathematics", cycles: ["cycle_1"] },
  { code: "LIT1", name: "Literacy 1", cycles: ["cycle_1"] },
  { code: "LIT2", name: "Literacy 2", cycles: ["cycle_1"] },
  { code: "READ", name: "Reading", cycles: ["cycle_1"] },
  { code: "RE", name: "Religious Education", cycles: ["cycle_1"] },
];

/** Upper-primary exam core — one click for P4 through P7. */
export interface PrimaryCoreDefault {
  code: string;
  name: string;
  cycles: NcdcCycle[];
  ple?: boolean;
  hint?: string;
}

export const PRIMARY_P4_P7_CORE_DEFAULTS: PrimaryCoreDefault[] = [
  {
    code: "ENG",
    name: "English",
    cycles: ["cycle_2", "cycle_3"],
    ple: true,
  },
  {
    code: "MATH",
    name: "Mathematics",
    cycles: ["cycle_2", "cycle_3"],
    ple: true,
  },
  {
    code: "SCI",
    name: "Science",
    cycles: ["cycle_2", "cycle_3"],
    ple: true,
  },
  {
    code: "SST",
    name: "Social Studies",
    cycles: ["cycle_2", "cycle_3"],
    ple: true,
    hint: "Includes RE content for PLE",
  },
];

export type PrimaryDefaultStatus = "missing" | "partial" | "complete";

export interface PrimaryDefaultPreviewRow extends PrimaryCoreDefault {
  status: PrimaryDefaultStatus;
  missingCycles: NcdcCycle[];
  existingName?: string;
}

export function previewPrimaryP4P7Defaults(
  subjects: { code: string; name: string; ncdc_cycles: string[] }[],
): PrimaryDefaultPreviewRow[] {
  return previewPrimaryDefaults(subjects, PRIMARY_P4_P7_CORE_DEFAULTS);
}

export function previewPrimaryP1P3Defaults(
  subjects: { code: string; name: string; ncdc_cycles: string[] }[],
): PrimaryDefaultPreviewRow[] {
  return previewPrimaryDefaults(subjects, PRIMARY_P1_P3_DEFAULTS);
}

function previewPrimaryDefaults(
  subjects: { code: string; name: string; ncdc_cycles: string[] }[],
  defaults: PrimaryCoreDefault[],
): PrimaryDefaultPreviewRow[] {
  const byCode = new Map(subjects.map((s) => [s.code.toUpperCase(), s]));

  return defaults.map((item) => {
    const existing = byCode.get(item.code.toUpperCase());
    const missingCycles = item.cycles.filter(
      (cycle) => !existing?.ncdc_cycles.includes(cycle),
    );
    let status: PrimaryDefaultStatus = "missing";
    if (missingCycles.length === 0) status = "complete";
    else if (existing) status = "partial";

    return {
      ...item,
      status,
      missingCycles,
      existingName: existing?.name,
    };
  });
}

export function primaryDefaultsToAdd(
  preview: PrimaryDefaultPreviewRow[],
): PrimaryDefaultPreviewRow[] {
  return preview.filter((row) => row.status !== "complete");
}
