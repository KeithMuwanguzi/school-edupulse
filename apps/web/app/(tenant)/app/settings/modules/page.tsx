"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  moduleIcon,
} from "@/lib/moduleMeta";
import {
  useGetTenantModulesQuery,
  useTenantModuleCatalogQuery,
} from "@/store/api/skulpulseApi";
import type { ModuleCatalogItem } from "@/lib/types";

function ugx(n: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(n)}`;
}

function categoryRank(cat: string): number {
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(cat);
  return i === -1 ? 99 : i;
}

export default function SettingsModulesPage() {
  const { data: catalog } = useTenantModuleCatalogQuery();
  const { data: tenantModules } = useGetTenantModulesQuery();

  if (!catalog) {
    return <ErrorBanner message="Unable to load module catalog." />;
  }

  const active = new Set(tenantModules?.modules ?? []);
  const invoice = tenantModules?.invoice;
  const activeCount = [...active].filter((m) => m !== "core").length;

  const groups = new Map<string, ModuleCatalogItem[]>();
  for (const item of catalog) {
    if (item.module_key === "core") continue;
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  const orderedGroups = [...groups.entries()].sort(
    (a, b) => categoryRank(a[0]) - categoryRank(b[0]),
  );

  return (
    <div className="space-y-5">
      {/* Plan summary */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
        <div className="grid grid-cols-1 sm:grid-cols-3">
          <SummaryCell label="Active modules" value={String(activeCount)} hint="beyond core" first />
          <SummaryCell
            label="Base fee"
            value={invoice ? ugx(invoice.platform_base_fee_ugx) : "—"}
            hint="platform, per term"
          />
          <SummaryCell
            label="Total per term"
            value={invoice ? ugx(invoice.total_per_term_ugx) : "—"}
            hint="base + modules"
            accent
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-slate-100/70 px-3 py-2 text-[11px] text-slate-500">
        <Icon name="alert-triangle" size={13} className="shrink-0 text-slate-400" />
        Subscriptions are managed by SkulPulse. Contact us to add or remove modules.
      </div>

      {orderedGroups.map(([category, items]) => (
        <section key={category}>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[12px] font-semibold tracking-tight text-slate-900">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {items
              .slice()
              .sort((a, b) => Number(active.has(b.module_key)) - Number(active.has(a.module_key)))
              .map((item) => {
                const on = active.has(item.module_key);
                return (
                  <div
                    key={item.module_key}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                      on
                        ? "border-brand-200 bg-brand-50/40"
                        : "border-slate-200/80 bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                        on
                          ? "bg-brand-600 text-white ring-brand-700/20"
                          : "bg-slate-100 text-slate-400 ring-slate-200/70",
                      )}
                    >
                      <Icon name={moduleIcon(item.module_key)} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold text-slate-900">
                          {item.name}
                        </p>
                        {on ? (
                          <Badge tone="green" dot>
                            Active
                          </Badge>
                        ) : (
                          <span className="shrink-0 text-[10px] font-medium text-slate-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] font-medium tabular-nums text-slate-600">
                        {ugx(item.price_per_term_ugx)}
                        <span className="font-normal text-slate-400"> / term</span>
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  first,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  first?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={cn("p-4", !first && "border-t border-slate-100 sm:border-l sm:border-t-0")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-[1.2rem] font-medium leading-none tracking-tight",
          accent ? "text-brand-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10.5px] text-slate-500">{hint}</p>
    </div>
  );
}
