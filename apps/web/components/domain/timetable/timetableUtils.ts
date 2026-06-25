import type { TimetableSlotOut } from "@/lib/types";
import { localTodayIso } from "@/lib/localDate";

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

/** "HH:MM:SS" or "HH:MM" → "HH:MM". */
export function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

/** Current ISO weekday (1 = Monday … 7 = Sunday). */
export function todayWeekday(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function todayIso(): string {
  return localTodayIso();
}

export function classLabel(slot: TimetableSlotOut): string {
  const base = slot.class_label ? `${slot.class_level} · ${slot.class_label}` : slot.class_level;
  return slot.stream_name ? `${base} (${slot.stream_name})` : base;
}

export function sortByStart(a: TimetableSlotOut, b: TimetableSlotOut): number {
  return a.starts_at.localeCompare(b.starts_at);
}

/** ISO weekday for a Date (1 = Monday … 7 = Sunday). */
export function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Build a Monday-first month grid as weeks of 7 Dates, padded with the
 * adjacent months' days so every week is complete.
 */
export function buildMonthGrid(cursor: Date): Date[][] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = isoWeekday(first) - 1;
  const weekCount = Math.ceil((startOffset + last.getDate()) / 7);

  const weeks: Date[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const dayNum = w * 7 + i - startOffset + 1;
      week.push(new Date(year, month, dayNum));
    }
    weeks.push(week);
  }
  return weeks;
}
