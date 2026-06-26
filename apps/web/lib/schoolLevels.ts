import type { NcdcCycle } from "@/lib/types";

/** Uganda nursery (ECD) and primary class levels — NCDC aligned. */
export type ClassLevel =
  | "BABY"
  | "MIDDLE"
  | "TOP"
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7";

export const NURSERY_LEVELS: ClassLevel[] = ["BABY", "MIDDLE", "TOP"];

export const PRIMARY_LEVELS: ClassLevel[] = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];

export const ALL_CLASS_LEVELS: ClassLevel[] = [...NURSERY_LEVELS, ...PRIMARY_LEVELS];

export const LEVEL_LABELS: Record<ClassLevel, string> = {
  BABY: "Baby Class",
  MIDDLE: "Middle Class",
  TOP: "Top Class",
  P1: "Primary One",
  P2: "Primary Two",
  P3: "Primary Three",
  P4: "Primary Four",
  P5: "Primary Five",
  P6: "Primary Six",
  P7: "Primary Seven",
};

export const LEVEL_CYCLE: Record<ClassLevel, NcdcCycle> = {
  BABY: "ecd",
  MIDDLE: "ecd",
  TOP: "ecd",
  P1: "cycle_1",
  P2: "cycle_1",
  P3: "cycle_1",
  P4: "cycle_2",
  P5: "cycle_3",
  P6: "cycle_3",
  P7: "cycle_3",
};

export const SECTION_LABELS = {
  nursery: "Nursery (ECD)",
  primary: "Primary",
} as const;

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level as ClassLevel] ?? level;
}

export function isNurseryLevel(level: string): boolean {
  return NURSERY_LEVELS.includes(level as ClassLevel);
}

export function classOptionLabel(level: string, label: string): string {
  return label ? `${level} · ${label}` : level;
}

export function cycleForLevel(level: string): NcdcCycle | undefined {
  return LEVEL_CYCLE[level as ClassLevel];
}
