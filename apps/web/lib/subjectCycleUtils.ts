import type { NcdcCycle, SubjectOut } from "@/lib/types";

export const CYCLE_TOGGLE_OPTIONS: { value: NcdcCycle; label: string }[] = [
  { value: "cycle_1", label: "P1–P3" },
  { value: "cycle_2", label: "P4" },
  { value: "cycle_3", label: "P5–P7" },
];

export function subjectByCode(
  subjects: SubjectOut[],
  code: string,
): SubjectOut | undefined {
  const c = code.trim().toUpperCase();
  return subjects.find((s) => s.code.toUpperCase() === c);
}

export function subjectHasCycle(subject: SubjectOut, cycle: NcdcCycle): boolean {
  return subject.ncdc_cycles.includes(cycle);
}

export function formatCycleLabels(cycles: NcdcCycle[]): string {
  const map: Record<NcdcCycle, string> = {
    cycle_1: "P1–P3",
    cycle_2: "P4",
    cycle_3: "P5–P7",
  };
  return cycles.map((c) => map[c]).join(", ");
}
