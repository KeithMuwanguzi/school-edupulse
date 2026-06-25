import { cn } from "@/lib/cn";
import { occupancyBarTone } from "./hostelUtils";

export function OccupancyBar({
  occupied,
  capacity,
  pct,
  className,
}: {
  occupied: number;
  capacity?: number | null;
  /** Optional pre-computed percentage; otherwise derived from occupied/capacity. */
  pct?: number;
  className?: string;
}) {
  const computed =
    pct ??
    (capacity && capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0);
  const untracked = capacity == null;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            untracked ? "bg-slate-300" : occupancyBarTone(computed),
          )}
          style={{ width: untracked ? "100%" : `${Math.max(computed, 2)}%` }}
        />
      </div>
    </div>
  );
}
