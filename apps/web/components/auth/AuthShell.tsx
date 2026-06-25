import { ReactNode } from "react";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/cn";

type AuthVariant = "tenant" | "platform";

interface AuthShellProps {
  variant: AuthVariant;
  eyebrow: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  sideTitle: string;
  sideBody: string;
  sideItems: string[];
  watermark: string;
  children: ReactNode;
}

export function AuthShell({
  variant,
  eyebrow,
  title,
  subtitle,
  footer,
  sideTitle,
  sideBody,
  sideItems,
  watermark,
  children,
}: AuthShellProps) {
  const isPlatform = variant === "platform";

  return (
    <main
      className={cn(
        "relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6",
        isPlatform ? "auth-bg-platform" : "app-canvas",
      )}
    >
      {/* Ambient blobs */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full blur-3xl",
          isPlatform ? "bg-brand-900/30" : "bg-brand-200/40",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full blur-3xl",
          isPlatform ? "bg-slate-700/25" : "bg-brand-300/25",
        )}
      />

      <div className="auth-card relative w-full max-w-[860px] overflow-hidden rounded-[1.75rem] bg-white shadow-soft ring-1 ring-slate-900/[0.06]">
        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          {/* Form column */}
          <div className="relative z-10 px-7 py-9 sm:px-9 sm:py-10 md:px-10 md:py-11">
            <AuthLogo compact className="md:hidden" />

            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 text-[1.35rem] font-semibold leading-snug tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 max-w-[18rem] text-[12px] leading-relaxed text-slate-500">
              {subtitle}
            </p>

            <div className="mt-6 max-w-[17.5rem]">{children}</div>

            {footer && <div className="mt-6 max-w-[17.5rem]">{footer}</div>}
          </div>

          {/* Brand / info panel with curved edge */}
          <div
            className={cn(
              "auth-split-panel relative hidden min-h-[420px] md:block",
              isPlatform
                ? "bg-gradient-to-br from-slate-800 via-slate-900 to-brand-900 text-white"
                : "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white",
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 80%, white 0%, transparent 45%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)",
              }}
            />

            <p
              aria-hidden
              className="pointer-events-none absolute bottom-6 right-4 select-none text-[4.5rem] font-bold leading-none tracking-tighter text-white/[0.06]"
            >
              {watermark}
            </p>

            <div className="relative flex h-full flex-col justify-between p-9 pl-12">
              <AuthLogo light />

              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-white/95">{sideTitle}</h2>
                  <p className="mt-2 max-w-[15rem] text-[12px] leading-relaxed text-white/75">
                    {sideBody}
                  </p>
                </div>
                <ul className="space-y-2">
                  {sideItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[11px] leading-snug text-white/80"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[10px] text-white/45">SkulPulse Uganda · Primary schools P1–P7</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function AuthLogo({
  light,
  compact,
  className,
}: {
  light?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", compact ? "mb-5" : "", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-lg font-bold",
          compact ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs",
          light ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-brand-600 text-white",
        )}
      >
        S
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight",
          compact ? "text-[13px]" : "text-sm",
          light ? "text-white" : "text-slate-900",
        )}
      >
        SkulPulse
      </span>
    </div>
  );
}

export function AuthField({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function AuthInput({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "auth-input h-8 w-full border-0 border-b bg-transparent px-0 pb-1.5 pt-0.5 text-[13px] text-slate-900",
        "placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-0",
        invalid ? "border-red-300" : "border-slate-200 focus:border-brand-500",
        className,
      )}
      {...props}
    />
  );
}

export function AuthSubmit({
  loading,
  children,
  className,
  type = "submit",
  disabled,
  onClick,
}: {
  loading?: boolean;
  children: ReactNode;
  className?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      onClick={onClick}
      className={cn(
        "mt-1 inline-flex h-8 w-full items-center justify-center gap-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em]",
        "bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,0.55)] transition",
        "hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}

/** Primary / ghost actions — same visual language as login, flexible width. */
export function AuthButton({
  loading,
  variant = "primary",
  children,
  className,
  type = "button",
  disabled,
  onClick,
}: {
  loading?: boolean;
  variant?: "primary" | "ghost";
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (variant === "ghost") {
    return (
      <button
        type={type}
        disabled={loading || disabled}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-medium text-slate-600 transition",
          "hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        )}
        {children}
      </button>
    );
  }

  return (
    <AuthSubmit
      type={type}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      className={cn("mt-0 w-auto px-5", className)}
    >
      {children}
    </AuthSubmit>
  );
}

export function AuthSelect({
  className,
  invalid,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "auth-input h-8 w-full cursor-pointer appearance-none border-0 border-b bg-transparent px-0 pb-1.5 pt-0.5 text-[13px] text-slate-900",
        "focus-visible:outline-none focus-visible:ring-0",
        invalid ? "border-red-300" : "border-slate-200 focus:border-brand-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function AuthTextarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "auth-textarea w-full min-h-[7rem] resize-y border-0 border-b border-slate-200 bg-transparent px-0 py-2 font-mono text-[11px] leading-relaxed text-slate-800",
        "placeholder:text-slate-300 focus:border-brand-500 focus:outline-none",
        invalid && "border-red-300",
        className,
      )}
      {...props}
    />
  );
}
