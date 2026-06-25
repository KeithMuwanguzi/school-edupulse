"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function TenantAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} homeHref="/app" homeLabel="Back to dashboard" />;
}
