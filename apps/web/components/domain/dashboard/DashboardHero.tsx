"use client";

import { cn } from "@/lib/cn";
import type { TermProgress } from "./dashboardUtils";

interface DashboardHeroProps {
  eyebrow: string;
  title: string;
  chips?: { label: string; highlight?: boolean }[];
  meta?: string;
  progress?: TermProgress | null;
}

export function DashboardHero({ eyebrow, title, chips = [], meta, progress }: DashboardHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-brand-800/40 bg-brand-700 text-white shadow-soft sm:rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(520px 280px at 88% -10%, rgba(229,166,39,0.2) 0%, transparent 60%), radial-gradient(480px 320px at 0% 120%, rgba(15,40,36,0.5) 0%, transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
            <span aria-hidden className="h-1 w-3.5 rounded-full bg-gold-400" />
            {eyebrow}
          </p>
          <h1 className="mt-1.5 truncate font-display text-[1.45rem] font-medium leading-tight tracking-tight sm:text-[1.65rem]">
            {title}
          </h1>
          {(chips.length > 0 || meta) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-brand-100">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1",
                    chip.highlight
                      ? "bg-white/10 ring-white/15"
                      : "bg-white/5 ring-white/10 text-brand-100/90",
                  )}
                >
                  {chip.highlight ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                  ) : null}
                  {chip.label}
                </span>
              ))}
              {meta ? <span className="text-brand-200/75">{meta}</span> : null}
            </div>
          )}
        </div>

        {progress ? (
          <div className="w-full shrink-0 rounded-lg bg-white/10 p-2.5 ring-1 ring-white/15 backdrop-blur-sm sm:max-w-[240px]">
            <div className="flex items-center justify-between text-[10px] font-medium text-brand-100">
              <span>
                Week {progress.currentWeek} of {progress.totalWeeks}
              </span>
              <span className="font-semibold text-white">{Math.round(progress.pct)}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gold-400 transition-[width] duration-700 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-brand-100">
              {progress.daysLeft > 0 ? `${progress.daysLeft} days left in term` : "Term complete"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
