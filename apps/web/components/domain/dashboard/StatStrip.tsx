"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { accentChip, type DashboardStat } from "./dashboardUtils";

export function StatStrip({ stats }: { stats: DashboardStat[] }) {
  if (stats.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div
        className={cn(
          "grid",
          stats.length === 1 && "grid-cols-1",
          stats.length === 2 && "grid-cols-2",
          stats.length === 3 && "grid-cols-2 sm:grid-cols-3",
          stats.length >= 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {stats.map((s, i) => {
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
                  accentChip[s.accent],
                )}
              >
                <Icon name={s.icon} size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {s.label}
                </p>
                <p className="mt-0.5 truncate font-display text-[1.15rem] font-medium leading-none tracking-tight text-slate-900">
                  {s.value}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{s.hint}</p>
              </div>
            </>
          );

          const cellClass = cn(
            "flex items-start gap-2.5 p-3.5 transition-colors",
            i % 2 === 1 && "border-l border-slate-100",
            i >= 2 && stats.length >= 3 && "border-t border-slate-100 sm:border-t-0",
            stats.length >= 4 && i >= 2 && "lg:border-t-0",
            stats.length >= 4 && "lg:border-l lg:[&:nth-child(4n+1)]:border-l-0",
            s.href && "hover:bg-slate-50/80",
          );

          return s.href ? (
            <Link key={s.label} href={s.href} className={cellClass}>
              {inner}
            </Link>
          ) : (
            <div key={s.label} className={cellClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
