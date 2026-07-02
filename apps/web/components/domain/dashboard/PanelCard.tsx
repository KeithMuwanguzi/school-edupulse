"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface PanelCardProps {
  icon: string;
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "warn" | "success";
}

const toneRing: Record<NonNullable<PanelCardProps["tone"]>, string> = {
  default: "ring-brand-100 bg-brand-50 text-brand-600",
  warn: "ring-amber-100 bg-amber-50 text-amber-600",
  success: "ring-emerald-100 bg-emerald-50 text-emerald-600",
};

export function PanelCard({
  icon,
  title,
  action,
  children,
  className,
  tone = "default",
}: PanelCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1",
              toneRing[tone],
            )}
          >
            <Icon name={icon} size={12} />
          </span>
          <h2 className="truncate text-[11.5px] font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-[10.5px] font-medium text-brand-600 hover:text-brand-700"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}

export function MetricRow({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className="text-right">
        <span
          className={cn(
            "text-[11.5px] font-semibold tabular-nums",
            warn ? "text-amber-700" : "text-slate-900",
          )}
        >
          {value}
        </span>
        {hint ? <span className="block text-[10px] text-slate-400">{hint}</span> : null}
      </span>
    </div>
  );
}

export function ProgressBar({
  pct,
  tone = "brand",
}: {
  pct: number;
  tone?: "brand" | "gold" | "emerald" | "amber";
}) {
  const fill: Record<typeof tone, string> = {
    brand: "bg-brand-500",
    gold: "bg-gold-400",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill[tone])}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
