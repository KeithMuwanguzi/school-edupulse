import type { NcdcCycle } from "@/lib/types";

/** Curated NCDC-aligned subjects for Ugandan primary (P1–P7). */
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
  // Cycle 1 — P1–P3 thematic (integrated learning areas)
  { code: "LIT", name: "Literacy", cycle: "cycle_1", hint: "Reading, writing, and language", recommended: true },
  { code: "NUM", name: "Numeracy", cycle: "cycle_1", hint: "Numbers and early mathematics", recommended: true },
  { code: "LIFE", name: "Life Skills", cycle: "cycle_1", hint: "Personal, social, and health education", recommended: true },
  { code: "CA", name: "Creative Arts", cycle: "cycle_1", hint: "Music, dance, drama, and art", recommended: true },
  { code: "PE", name: "Physical Education", cycle: "cycle_1", recommended: true },
  { code: "RE", name: "Religious Education", cycle: "cycle_1", recommended: true },
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

export function catalogForCycle(cycle: NcdcCycle): NcdcSubjectSuggestion[] {
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
  return NCDC_SUBJECT_CATALOG.find((s) => s.cycle === cycle && s.code === c);
}
