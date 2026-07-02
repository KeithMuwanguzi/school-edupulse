export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

export interface TermProgress {
  pct: number;
  daysLeft: number;
  totalWeeks: number;
  currentWeek: number;
}

export function termProgress(startsOn?: string | null, endsOn?: string | null): TermProgress | null {
  if (!startsOn || !endsOn) return null;
  const start = new Date(startsOn).getTime();
  const end = new Date(endsOn).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const daysLeft = Math.max(0, Math.round((end - now) / 86_400_000));
  const totalWeeks = Math.max(1, Math.round((end - start) / (7 * 86_400_000)));
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.ceil((Math.min(now, end) - start) / (7 * 86_400_000))),
  );
  return { pct, daysLeft, totalWeeks, currentWeek };
}

export type Accent = "brand" | "gold" | "blue" | "slate" | "amber" | "emerald";

export interface DashboardStat {
  icon: string;
  label: string;
  value: string;
  hint: string;
  accent: Accent;
  href?: string;
}

export const accentChip: Record<Accent, string> = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-200/70",
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200/70",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
};

export function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export const todayIso = new Date().toISOString().slice(0, 10);
