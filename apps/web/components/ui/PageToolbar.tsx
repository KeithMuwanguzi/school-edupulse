import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Responsive action row: stacks on phone, wraps on tablet, inline on desktop. */
export function PageToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageToolbarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
