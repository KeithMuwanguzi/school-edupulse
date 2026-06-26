import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SettingsStatRow({
  items,
}: {
  items: { label: string; value: number | string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 ring-1 ring-slate-200/60"
        >
          {item.label}
          <span className="tabular-nums font-semibold text-slate-800">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export function SettingsFilterPills({
  options,
  active,
  onChange,
}: {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-100/70 p-0.5">
        {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
            active === opt.id
              ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200/70"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          {opt.label}
        </button>
      ))}
      </div>
    </div>
  );
}

export function SettingsEmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-[12px] leading-relaxed text-slate-400">{message}</p>
  );
}

export function SettingsHint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-slate-400">{children}</p>;
}
