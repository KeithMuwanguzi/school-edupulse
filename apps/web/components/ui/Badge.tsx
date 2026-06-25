import { cn } from "@/lib/cn";

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "gold";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70",
  green: "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-1 ring-red-100",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  gold: "bg-gold-50 text-gold-700 ring-1 ring-gold-200/70",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-slate-400",
  green: "bg-brand-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  gold: "bg-gold-400",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "green",
  trial: "blue",
  suspended: "amber",
  inactive: "neutral",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {status}
    </Badge>
  );
}
