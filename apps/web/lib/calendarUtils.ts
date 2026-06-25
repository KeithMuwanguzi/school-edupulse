/** Date helpers for the academic calendar UI. */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const TERM_PALETTE = [
  {
    key: 1,
    label: "Term 1",
    gradient: "from-emerald-500 to-teal-600",
    soft: "bg-emerald-50 border-emerald-200 text-emerald-800",
    ring: "ring-emerald-400/40",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    key: 2,
    label: "Term 2",
    gradient: "from-sky-500 to-blue-600",
    soft: "bg-sky-50 border-sky-200 text-sky-800",
    ring: "ring-sky-400/40",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
  },
  {
    key: 3,
    label: "Term 3",
    gradient: "from-violet-500 to-purple-600",
    soft: "bg-violet-50 border-violet-200 text-violet-800",
    ring: "ring-violet-400/40",
    bar: "bg-violet-500",
    dot: "bg-violet-500",
  },
] as const;

export function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDate(value?: string | null): string {
  const d = parseIsoDate(value);
  if (!d) return "Not set";
  return d.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(value?: string | null): string {
  const d = parseIsoDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "short" });
}

export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function termProgress(start?: string | null, end?: string | null): number {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e) return 0;
  const now = new Date();
  if (now < s) return 0;
  if (now > e) return 100;
  const total = daysBetween(s, e);
  const elapsed = daysBetween(s, now);
  return Math.min(100, Math.round((elapsed / total) * 100));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function firstWeekday(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

/** Compare calendar dates (ignores time). */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type TermRangeMarker<T> = {
  term: T;
  start: Date | null;
  end: Date | null;
  palette: (typeof TERM_PALETTE)[number];
};

export function dayTermMarkers<T extends { id: string; label: string; status: string }>(
  date: Date,
  ranges: TermRangeMarker<T>[],
): {
  inRange: TermRangeMarker<T> | null;
  starts: TermRangeMarker<T>[];
  ends: TermRangeMarker<T>[];
} {
  const starts: TermRangeMarker<T>[] = [];
  const ends: TermRangeMarker<T>[] = [];
  let inRange: TermRangeMarker<T> | null = null;

  for (const r of ranges) {
    if (r.start && isSameCalendarDay(date, r.start)) starts.push(r);
    if (r.end && isSameCalendarDay(date, r.end)) ends.push(r);
    if (r.start && r.end && date >= r.start && date <= r.end) {
      if (!inRange || r.term.status === "active") inRange = r;
    }
  }

  return { inRange, starts, ends };
}

export { MONTHS };
