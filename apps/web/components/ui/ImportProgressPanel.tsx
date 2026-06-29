"use client";

export interface ImportProgressState {
  done: number;
  total: number;
  phase: string;
}

export function ImportProgressPanel({
  progress,
}: {
  progress: ImportProgressState | null;
}) {
  if (!progress || progress.total <= 0) return null;

  const pct = Math.min(100, Math.round((progress.done / progress.total) * 100));

  return (
    <div
      className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-[12px] font-medium text-brand-900">
        {progress.phase} — {progress.done} of {progress.total} rows ({pct}%)
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
