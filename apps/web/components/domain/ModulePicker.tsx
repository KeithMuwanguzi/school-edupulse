"use client";

import { useMemo } from "react";
import { cn, formatUGX } from "@/lib/cn";
import type { ModuleCatalogItem } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  base: "Core",
  academic: "Academic",
  operations: "Operations",
  intelligence: "Intelligence",
  addon: "Add-ons",
};

interface ModulePickerProps {
  catalog: ModuleCatalogItem[];
  selected: string[];
  onChange: (keys: string[]) => void;
  baseFeeUgx: number;
  disabled?: boolean;
}

export function ModulePicker({
  catalog,
  selected,
  onChange,
  baseFeeUgx,
  disabled,
}: ModulePickerProps) {
  const grouped = useMemo(() => {
    const byCat: Record<string, ModuleCatalogItem[]> = {};
    for (const m of catalog) (byCat[m.category] ??= []).push(m);
    return byCat;
  }, [catalog]);

  const moduleTotal = useMemo(
    () =>
      catalog
        .filter((m) => selected.includes(m.module_key))
        .reduce((sum, m) => sum + m.price_per_term_ugx, 0),
    [catalog, selected],
  );

  function toggle(key: string) {
    if (key === "core" || disabled) return;
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, mods]) => (
        <div key={category}>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {CATEGORY_LABELS[category] ?? category}
          </h4>
          <div className="space-y-1.5">
            {mods.map((m) => {
              const checked = selected.includes(m.module_key);
              const locked = m.module_key === "core";
              return (
                <label
                  key={m.module_key}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition",
                    checked
                      ? "border-brand-200 bg-brand-50/40 ring-1 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-slate-300",
                    (locked || disabled) && "cursor-not-allowed opacity-90",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus-visible:ring-brand-500"
                    checked={checked}
                    disabled={locked || disabled}
                    onChange={() => toggle(m.module_key)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-slate-900">{m.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {m.price_per_term_ugx === 0 ? "Included" : formatUGX(m.price_per_term_ugx)}
                      </span>
                    </div>
                    {m.description && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                        {m.description}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[12px]">
        <div className="flex justify-between text-slate-500">
          <span>Platform base fee</span>
          <span>{formatUGX(baseFeeUgx)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Modules ({selected.length})</span>
          <span>{formatUGX(moduleTotal)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-[12px] font-semibold text-slate-900">
          <span>Total per term</span>
          <span>{formatUGX(baseFeeUgx + moduleTotal)}</span>
        </div>
      </div>
    </div>
  );
}
