"use client";

import Link from "next/link";
import { ParentDashboardView } from "@/components/domain/parent/ParentDashboardView";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { moduleIcon, moduleLabel, sortModulesByCatalog } from "@/lib/moduleMeta";
import { useSchoolSetup } from "@/hooks/useSchoolSetup";
import { useAppSelector } from "@/store/hooks";
import {
  useAcademicContextQuery,
  useAttendanceSummaryQuery,
  useGetTenantSchoolQuery,
  useListClassesQuery,
  useListSubjectsQuery,
  useRosterSummaryQuery,
} from "@/store/api/skulpulseApi";

const todayIso = new Date().toISOString().slice(0, 10);

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

interface TermProgress {
  pct: number;
  daysLeft: number;
  totalWeeks: number;
  currentWeek: number;
}

function termProgress(startsOn?: string | null, endsOn?: string | null): TermProgress | null {
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

type Accent = "brand" | "gold" | "blue" | "slate";

const accentChip: Record<Accent, string> = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-200/70",
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200/70",
};

interface Stat {
  icon: string;
  label: string;
  value: string;
  hint: string;
  accent: Accent;
}

function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex items-start gap-3 p-4",
              i % 2 === 1 && "border-l border-slate-100",
              i >= 2 && "border-t border-slate-100",
              "lg:border-t-0 lg:border-l lg:[&:nth-child(4n+1)]:border-l-0",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                accentChip[s.accent],
              )}
            >
              <Icon name={s.icon} size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {s.label}
              </p>
              <p className="mt-0.5 truncate font-display text-[1.3rem] font-medium leading-none tracking-tight text-slate-900">
                {s.value}
              </p>
              <p className="mt-1 truncate text-[10.5px] text-slate-500">{s.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({ moduleKey }: { moduleKey: string }) {
  return (
    <Link
      href={`/app/m/${moduleKey}`}
      className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-600 group-hover:text-white">
        <Icon name={moduleIcon(moduleKey)} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-slate-900">
          {moduleLabel(moduleKey)}
        </span>
        <span className="block truncate text-[10.5px] text-slate-500">Open module</span>
      </span>
      <Icon
        name="arrow-right"
        size={14}
        className="shrink-0 -translate-x-1 text-slate-300 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-brand-500 group-hover:opacity-100"
      />
    </Link>
  );
}

function ChecklistRow({
  done,
  skipped,
  label,
  href,
  tier,
}: {
  done: boolean;
  skipped?: boolean;
  label: string;
  href: string;
  tier?: "mandatory" | "optional";
}) {
  const resolved = done || skipped;
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
          done
            ? "bg-brand-600 text-white ring-brand-600"
            : skipped
              ? "bg-slate-100 text-slate-400 ring-slate-200"
              : "bg-white text-slate-300 ring-slate-300 group-hover:ring-brand-300",
        )}
      >
        {done ? (
          <Icon name="check" size={12} className="[&>circle]:hidden" />
        ) : skipped ? (
          <Icon name="minus" size={10} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[11.5px]",
            resolved ? "text-slate-400 line-through" : "font-medium text-slate-700",
          )}
        >
          {label}
        </span>
        {tier === "optional" && !resolved && (
          <span className="block text-[9.5px] text-slate-400">Optional</span>
        )}
      </span>
      {!resolved && (
        <Icon
          name="arrow-right"
          size={13}
          className="text-slate-300 transition-colors group-hover:text-brand-500"
        />
      )}
    </Link>
  );
}

export default function TenantDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "school_admin";
  const isParent = user?.role === "parent";
  const moduleKeys = user?.modules ?? [];
  const has = (m: string) => moduleKeys.includes(m);

  const { data: school } = useGetTenantSchoolQuery();
  const { data: ctx } = useAcademicContextQuery();
  const { data: roster } = useRosterSummaryQuery(undefined, { skip: !has("students") });
  const { data: attendance } = useAttendanceSummaryQuery(
    { date: todayIso },
    { skip: !has("attendance") },
  );
  const { data: classes } = useListClassesQuery(undefined, { skip: !isAdmin });
  const { data: subjects } = useListSubjectsQuery(undefined, { skip: !isAdmin });
  const { evaluation: setup } = useSchoolSetup(isAdmin);

  if (isParent) {
    return <ParentDashboardView userName={user?.name} />;
  }

  const subscribed = sortModulesByCatalog(moduleKeys.filter((m) => m !== "core"));
  const progress = termProgress(ctx?.active_term?.starts_on, ctx?.active_term?.ends_on);

  const classCount = roster?.classes.length ?? classes?.length ?? null;

  // Build up to four meaningful stats, padding with always-available facts.
  const stats: Stat[] = [];
  if (has("students") && roster) {
    stats.push({
      icon: "graduation",
      label: "Students",
      value: roster.total.toLocaleString(),
      hint: roster.unassigned > 0 ? `${roster.unassigned} unassigned` : "all placed",
      accent: "brand",
    });
  }
  if (has("attendance")) {
    const marked = attendance?.total_marked ?? 0;
    const rate = marked > 0 ? Math.round((attendance!.present / marked) * 100) : null;
    stats.push({
      icon: "percent",
      label: "Attendance today",
      value: rate === null ? "—" : `${rate}%`,
      hint:
        marked > 0
          ? `${marked}/${attendance?.total_enrolled ?? 0} marked`
          : "roll not taken yet",
      accent: "gold",
    });
  }
  if (classCount !== null) {
    stats.push({
      icon: "grid",
      label: "Classes",
      value: String(classCount),
      hint: isAdmin && subjects ? `${subjects.length} subjects` : "active this year",
      accent: "blue",
    });
  }
  stats.push({
    icon: "spark",
    label: "Active modules",
    value: String(subscribed.length),
    hint: subscribed.length > 0 ? "subscribed features" : "core only",
    accent: "slate",
  });
  if (stats.length < 4 && ctx?.active_term?.label) {
    stats.push({
      icon: "calendar",
      label: "Active term",
      value: ctx.active_term.label,
      hint: ctx.academic_year?.label ?? "this year",
      accent: "gold",
    });
  }
  const shownStats = stats.slice(0, 4);

  // Admin getting-started checklist (shared with onboarding gate).
  const checklistMandatory = setup?.mandatory ?? [];
  const checklistOptional = setup?.optional ?? [];
  const checklistDone = setup?.totalResolved ?? 0;
  const checklistTotal = setup?.totalApplicable ?? 0;

  return (
    <div className="space-y-5 animate-fade-rise">
      {/* Hero band */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-800/40 bg-brand-700 text-white shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(620px 320px at 88% -10%, rgba(229,166,39,0.22) 0%, transparent 60%), radial-gradient(520px 360px at 0% 120%, rgba(15,40,36,0.55) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
              <span aria-hidden className="h-1 w-4 rounded-full bg-gold-400" />
              {greeting()}, {firstName(user?.name)}
            </p>
            <h1 className="mt-2 truncate font-display text-[1.6rem] font-medium leading-tight tracking-tight sm:text-[1.9rem]">
              {school?.profile?.name ?? "Your school"}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-brand-100">
              {ctx?.active_term?.label && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 font-semibold ring-1 ring-white/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                  {ctx.active_term.label}
                </span>
              )}
              {ctx?.academic_year?.label && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 font-semibold ring-1 ring-white/15">
                  {ctx.academic_year.label}
                </span>
              )}
              {school?.school_code && (
                <span className="text-brand-200/80">Code {school.school_code}</span>
              )}
            </div>
          </div>

          {progress && (
            <div className="w-full max-w-none shrink-0 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm sm:max-w-[260px]">
              <div className="flex items-center justify-between text-[10.5px] font-medium text-brand-100">
                <span>
                  Week {progress.currentWeek} of {progress.totalWeeks}
                </span>
                <span className="font-semibold text-white">{Math.round(progress.pct)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gold-400 transition-[width] duration-700 ease-out"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="mt-2 text-[10.5px] text-brand-100">
                {progress.daysLeft > 0
                  ? `${progress.daysLeft} days left in term`
                  : "Term complete"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Stat strip */}
      {shownStats.length > 0 && <StatStrip stats={shownStats} />}

      {/* Lower grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Quick actions */}
        <section className="lg:col-span-2">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold tracking-tight text-slate-900">
              Jump back in
            </h2>
            {isAdmin && (
              <Link
                href="/app/settings/modules"
                className="text-[11px] font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                Manage modules
              </Link>
            )}
          </div>
          {subscribed.length === 0 ? (
            <EmptyState
              icon={<Icon name="grid" size={18} />}
              title="No modules yet"
              description="Your school is on the core plan. Subscribed modules will appear here as quick shortcuts."
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {subscribed.map((m) => (
                <QuickAction key={m} moduleKey={m} />
              ))}
            </div>
          )}
        </section>

        {/* Right rail */}
        <section className="lg:col-span-1 space-y-4">
          {isAdmin ? (
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <Icon name="check" size={13} />
                  </span>
                  <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                    Getting started
                  </h3>
                </div>
                <Badge tone={checklistDone === checklistTotal && checklistTotal > 0 ? "green" : "gold"}>
                  {checklistDone}/{checklistTotal}
                </Badge>
              </div>
              <div className="px-2 py-2">
                {checklistMandatory.map((c) => (
                  <ChecklistRow
                    key={c.id}
                    done={c.done}
                    skipped={c.skipped}
                    label={c.title}
                    href={c.href}
                    tier="mandatory"
                  />
                ))}
                {checklistOptional.length > 0 && (
                  <>
                    <p className="px-2 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">
                      Optional
                    </p>
                    {checklistOptional.map((c) => (
                      <ChecklistRow
                        key={c.id}
                        done={c.done}
                        skipped={c.skipped}
                        label={c.title}
                        href={c.href}
                        tier="optional"
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[12px] font-semibold tracking-tight text-slate-900">
                  Your access
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Signed in as {user?.role?.replace("_", " ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 px-4 py-3.5">
                {subscribed.length === 0 ? (
                  <p className="text-[11.5px] text-slate-500">Core access only.</p>
                ) : (
                  subscribed.map((m) => (
                    <Badge key={m} tone="green">
                      {moduleLabel(m)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
