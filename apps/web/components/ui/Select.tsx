import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-8 w-full rounded-lg border bg-white px-2.5 text-[13px] text-slate-900 transition",
        "focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20",
        invalid ? "border-red-300" : "border-slate-200 hover:border-slate-300",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
