"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

interface RefreshButtonProps {
  onRefresh: () => unknown;
  isRefreshing?: boolean;
  label?: string;
  className?: string;
}

export function RefreshButton({
  onRefresh,
  isRefreshing = false,
  label = "Refresh",
  className,
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={isRefreshing}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      <Icon name="refresh" size={14} className={cn(isRefreshing && "animate-spin")} />
    </button>
  );
}

export async function refreshQueries(...refetches: Array<() => unknown>) {
  await Promise.all(refetches.map((refetch) => refetch()));
}
