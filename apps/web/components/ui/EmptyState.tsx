import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      {icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card ring-1 ring-slate-200/70">
          {icon}
        </span>
      )}
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
