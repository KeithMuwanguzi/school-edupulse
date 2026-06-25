"use client";

import { moduleLabel, sortModulesByCatalog } from "@/lib/moduleMeta";
import { cn } from "@/lib/cn";
import { useGetTenantModulesQuery } from "@/store/api/skulpulseApi";

interface ModuleScopePickerProps {
  /** null = full access (inherit the school's subscribed set). */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /** school_admin always has full access — the picker is hidden for them. */
  role: string;
  disabled?: boolean;
}

/**
 * Lets an admin restrict a single user to a subset of the school's subscribed
 * modules. `null` means no restriction (the user sees everything the school has).
 */
export function ModuleScopePicker({ value, onChange, role, disabled }: ModuleScopePickerProps) {
  const { data } = useGetTenantModulesQuery();
  const available = sortModulesByCatalog(
    (data?.modules ?? []).filter((m) => m !== "core"),
  );

  if (role === "school_admin") {
    return (
      <p className="text-[11px] text-slate-400">
        Administrators always have access to every subscribed module.
      </p>
    );
  }

  const limited = value !== null;
  const selected = new Set(value ?? []);

  function setMode(next: "all" | "limited") {
    if (next === "all") onChange(null);
    else onChange(value ?? []);
  }

  function toggle(key: string) {
    const nextSet = new Set(selected);
    if (nextSet.has(key)) nextSet.delete(key);
    else nextSet.add(key);
    onChange([...nextSet]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ModeButton active={!limited} disabled={disabled} onClick={() => setMode("all")}>
          All subscribed modules
        </ModeButton>
        <ModeButton active={limited} disabled={disabled} onClick={() => setMode("limited")}>
          Limit to specific modules
        </ModeButton>
      </div>

      {limited && (
        <>
          {available.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              The school has no optional modules to assign yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((key) => {
                const on = selected.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(key)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      on
                        ? "border-brand-300 bg-brand-50 text-brand-800"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    {moduleLabel(key)}
                  </button>
                );
              })}
            </div>
          )}
          {limited && selected.size === 0 && (
            <p className="text-[11px] text-amber-700">
              No modules selected — this user will only see the dashboard.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </button>
  );
}
