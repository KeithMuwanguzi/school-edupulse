"use client";

import { cn } from "@/lib/cn";

interface ErrorBannerProps {
  message: string;
  requestId?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorBanner({ message, requestId, compact, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-red-200 bg-red-50 text-red-800",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        className,
      )}
    >
      <p>{message}</p>
      {requestId && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(requestId)}
          className={cn(
            "mt-1 underline opacity-80 hover:opacity-100",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Support ref: {requestId.slice(0, 8)} — copy
        </button>
      )}
    </div>
  );
}
