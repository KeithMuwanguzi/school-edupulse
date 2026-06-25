import { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page title + one obvious primary action. Compact, with a characterful display H1. */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">
            <span aria-hidden className="h-1 w-4 rounded-full bg-gold-400" />
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "font-display text-[1.45rem] font-medium leading-tight tracking-tight text-slate-900",
            eyebrow && "mt-1.5",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 [&_a]:w-full [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}
