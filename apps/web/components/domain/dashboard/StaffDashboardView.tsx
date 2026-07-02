"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { useSchoolSetup } from "@/hooks/useSchoolSetup";
import type { Me } from "@/lib/types";
import { DashboardHero } from "./DashboardHero";
import { StatStrip } from "./StatStrip";
import {
  AdminDashboardPanels,
  TeacherDashboardPanels,
  TeacherSchedulePanel,
} from "./DashboardPanels";
import { buildDashboardStats, roleLabel } from "./buildDashboardStats";
import { firstName, greeting, termProgress } from "./dashboardUtils";
import { useStaffDashboardData } from "./useStaffDashboardData";

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
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
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
        {tier === "optional" && !resolved ? (
          <span className="block text-[9.5px] text-slate-400">Optional</span>
        ) : null}
      </span>
      {!resolved ? (
        <Icon
          name="arrow-right"
          size={13}
          className="text-slate-300 transition-colors group-hover:text-brand-500"
        />
      ) : null}
    </Link>
  );
}

function SetupChecklist({ isAdmin }: { isAdmin: boolean }) {
  const { evaluation: setup } = useSchoolSetup(isAdmin);
  if (!isAdmin || !setup) return null;

  const checklistMandatory = setup.mandatory ?? [];
  const checklistOptional = setup.optional ?? [];
  const checklistDone = setup.totalResolved ?? 0;
  const checklistTotal = setup.totalApplicable ?? 0;

  if (checklistTotal === 0) return null;

  return (
    <aside className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="check" size={13} />
          </span>
          <h3 className="text-[11.5px] font-semibold tracking-tight text-slate-900">
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
        {checklistOptional.length > 0 ? (
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
        ) : null}
      </div>
    </aside>
  );
}

function ActionsSidebar({
  data,
  role,
}: {
  data: ReturnType<typeof useStaffDashboardData>;
  role: string;
}) {
  if (data.isAdmin) {
    return <SetupChecklist isAdmin />;
  }

  if (data.isTeacher) {
    return (
      <div className="space-y-3">
        {data.has("timetable") || data.has("attendance") ? (
          <TeacherSchedulePanel data={data} />
        ) : null}
        <aside className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Signed in as
          </p>
          <p className="mt-1 text-[12px] font-medium text-slate-800">{roleLabel(role)}</p>
          {data.ctx?.active_term?.label ? (
            <p className="mt-2 text-[10.5px] text-slate-500">
              {data.ctx.active_term.label}
              {data.ctx.academic_year?.label ? ` · ${data.ctx.academic_year.label}` : ""}
            </p>
          ) : null}
        </aside>
      </div>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Overview
      </p>
      <p className="mt-1 text-[12px] font-medium text-slate-800">{roleLabel(role)}</p>
      <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
        Key metrics for your role appear in the panels. Use the sidebar to jump into any module.
      </p>
    </aside>
  );
}

export function StaffDashboardView({ user }: { user: Me }) {
  const data = useStaffDashboardData(user);
  const stats = buildDashboardStats(data);
  const progress = termProgress(data.ctx?.active_term?.starts_on, data.ctx?.active_term?.ends_on);

  const chips = [
    data.ctx?.active_term?.label
      ? { label: data.ctx.active_term.label, highlight: true }
      : null,
    data.ctx?.academic_year?.label ? { label: data.ctx.academic_year.label } : null,
  ].filter(Boolean) as { label: string; highlight?: boolean }[];

  return (
    <div className="space-y-4 animate-fade-rise">
      <DashboardHero
        eyebrow={`${greeting()}, ${firstName(user.name)}`}
        title={data.school?.profile?.name ?? "Your school"}
        chips={chips}
        meta={data.school?.school_code ? `Code ${data.school.school_code}` : undefined}
        progress={progress}
      />

      {stats.length > 0 ? <StatStrip stats={stats} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-[11.5px] font-semibold tracking-tight text-slate-900">
            {user.role === "teacher" ? "Your day" : "School insights"}
          </h2>
          {user.role === "teacher" ? (
            <TeacherDashboardPanels data={data} />
          ) : (
            <AdminDashboardPanels data={data} />
          )}
        </section>

        <section className="lg:col-span-1">
          <ActionsSidebar data={data} role={user.role} />
        </section>
      </div>
    </div>
  );
}
