import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(21,101,90,0.7)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none",
  accent:
    "bg-gold-400 text-slate-900 shadow-[0_10px_22px_-12px_rgba(229,166,39,0.7)] hover:bg-gold-300 active:bg-gold-500 disabled:bg-gold-200 disabled:shadow-none",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60",
  ghost: "text-slate-600 hover:bg-slate-100 active:bg-slate-200/70 disabled:opacity-60",
  danger:
    "bg-red-600 text-white shadow-[0_10px_22px_-12px_rgba(220,38,38,0.5)] hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 disabled:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-3 text-[11px]",
  md: "h-8 px-4 text-[12px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold tracking-[0.01em] transition-[background-color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
      )}
      {children}
    </button>
  );
});
