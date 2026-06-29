import type { NcdcCycle } from "@/lib/types";

/** Uganda UNEB-style grade band for subject scales (P1–P7). */
export interface GradeBandTemplate {
  label: string;
  aggregate_weight: number;
  min_mark: number;
  max_mark: number;
  /** Short descriptor shown on subject rows — e.g. Excellent, Very good. */
  comment: string;
}

export interface AggregateDivisionTemplate {
  label: string;
  min_aggregate: number;
  max_aggregate: number;
  class_teacher_comment?: string;
  head_teacher_comment?: string;
}

/** Standard UNEB letter grades — D1 (best) through F9. Weights drive PLE aggregate. */
export const UNEB_PLE_GRADE_BANDS: GradeBandTemplate[] = [
  { label: "D1", aggregate_weight: 1, min_mark: 90, max_mark: 100, comment: "Excellent" },
  { label: "D2", aggregate_weight: 2, min_mark: 80, max_mark: 89, comment: "Very good" },
  { label: "C3", aggregate_weight: 3, min_mark: 75, max_mark: 79, comment: "Good" },
  { label: "C4", aggregate_weight: 4, min_mark: 70, max_mark: 74, comment: "Fairly good" },
  { label: "C5", aggregate_weight: 5, min_mark: 65, max_mark: 69, comment: "Fair" },
  { label: "C6", aggregate_weight: 6, min_mark: 60, max_mark: 64, comment: "Average" },
  { label: "P7", aggregate_weight: 7, min_mark: 50, max_mark: 59, comment: "Weak" },
  { label: "P8", aggregate_weight: 8, min_mark: 40, max_mark: 49, comment: "Poor" },
  { label: "F9", aggregate_weight: 9, min_mark: 0, max_mark: 39, comment: "Fail" },
];

/** Overall PLE aggregate divisions (best four core subjects). */
export const UNEB_PLE_AGGREGATE_DIVISIONS: AggregateDivisionTemplate[] = [
  {
    label: "Division I",
    min_aggregate: 4,
    max_aggregate: 12,
    class_teacher_comment: "Excellent overall performance this term.",
    head_teacher_comment: "Division I — a credit to the school. Congratulations.",
  },
  {
    label: "Division II",
    min_aggregate: 13,
    max_aggregate: 24,
    class_teacher_comment: "Very good overall performance. Keep working hard.",
    head_teacher_comment: "Division II — well done. Aim for Division I.",
  },
  {
    label: "Division III",
    min_aggregate: 25,
    max_aggregate: 29,
    class_teacher_comment: "Good effort overall. Focus on core subjects.",
    head_teacher_comment: "Division III — more focus will yield better results.",
  },
  {
    label: "Division IV",
    min_aggregate: 30,
    max_aggregate: 34,
    class_teacher_comment: "Fair performance overall. Seek help in weak subjects.",
    head_teacher_comment: "Division IV — an improvement plan is required.",
  },
  {
    label: "Ungraded (U)",
    min_aggregate: 35,
    max_aggregate: 36,
    class_teacher_comment: "Did not meet the minimum aggregate standard.",
    head_teacher_comment: "Ungraded — remedial programme strongly recommended.",
  },
];

export function defaultScaleNameForCycle(cycle: NcdcCycle): string {
  switch (cycle) {
    case "cycle_1":
      return "Standard · P1–P3";
    case "cycle_2":
      return "Standard · P4";
    case "cycle_3":
      return "Standard UNEB · P5–P7";
    default:
      return "Standard scale";
  }
}

export function scaleTemplateLabel(cycle: NcdcCycle): string {
  return cycle === "cycle_3" ? "UNEB PLE (D1–F9)" : "UNEB grades (D1–F9)";
}

/** Mark-range-first template — same D1–F9 bands, emphasises score ranges over aggregates. */
export function markRangeTemplateLabel(_cycle: NcdcCycle): string {
  return "Mark ranges (D1–F9)";
}

export const MARK_RANGE_GRADE_BANDS = UNEB_PLE_GRADE_BANDS;

export function bandByAggregateWeight(weight: number): GradeBandTemplate | undefined {
  return UNEB_PLE_GRADE_BANDS.find((b) => b.aggregate_weight === weight);
}

export function bandByLabel(label: string): GradeBandTemplate | undefined {
  const normalized = label.trim().toUpperCase();
  return UNEB_PLE_GRADE_BANDS.find((b) => b.label.toUpperCase() === normalized);
}

export function formatMarkRange(min: number, max: number): string {
  return `${min}–${max}%`;
}

/** Dropdown options for aggregate-centred grade bands (1 = best). */
export const AGGREGATE_GRADE_OPTIONS = UNEB_PLE_GRADE_BANDS.map((b) => ({
  weight: b.aggregate_weight,
  label: b.label,
  comment: b.comment,
  markRange: formatMarkRange(b.min_mark, b.max_mark),
}));
