"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Where the "Back" link points (defaults to the tenant dashboard). */
  homeHref?: string;
  homeLabel?: string;
  title?: string;
  description?: string;
}

/**
 * Branded fallback for App Router `error.tsx` boundaries. Keeps the app shell
 * intact and offers a recover ("Try again") plus a safe escape route.
 */
export function RouteError({
  error,
  reset,
  homeHref = "/app",
  homeLabel = "Back to dashboard",
  title = "This page hit a snag",
  description = "Something went wrong while loading this section. You can retry, or head back and try again.",
}: RouteErrorProps) {
  useEffect(() => {
    // Surface in the console for diagnostics; server logs hold the full trace.
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-800">{title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{description}</p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-slate-400">Ref: {error.digest}</p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Link href={homeHref}>
            <Button size="sm" variant="secondary">
              {homeLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
