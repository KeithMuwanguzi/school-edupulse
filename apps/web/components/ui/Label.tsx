import { cn } from "@/lib/cn";

/** Shared field label — matches auth screens (compact, uppercase). */
export function Label({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400",
        className,
      )}
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}
