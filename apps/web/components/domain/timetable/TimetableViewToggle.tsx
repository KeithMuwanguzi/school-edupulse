"use client";

export type TimetableViewMode = "today" | "week" | "month";

interface TimetableViewToggleProps {
  mode: TimetableViewMode;
  onChange: (mode: TimetableViewMode) => void;
  /** Hide "Today" on desktop where the grid view is primary. */
  compact?: boolean;
}

const ALL_OPTIONS: { id: TimetableViewMode; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function TimetableViewToggle({ mode, onChange, compact = false }: TimetableViewToggleProps) {
  const options = compact
    ? ALL_OPTIONS.filter((o) => o.id !== "today")
    : ALL_OPTIONS;

  return (
    <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max rounded-md border border-slate-200 bg-white p-0.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`shrink-0 rounded px-3 py-1.5 text-[11px] font-medium transition sm:px-2.5 sm:py-1 ${
              mode === opt.id
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
