"use client";

export type TimetableViewMode = "week" | "month";

interface TimetableViewToggleProps {
  mode: TimetableViewMode;
  onChange: (mode: TimetableViewMode) => void;
}

const OPTIONS: { id: TimetableViewMode; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function TimetableViewToggle({ mode, onChange }: TimetableViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
            mode === opt.id
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
