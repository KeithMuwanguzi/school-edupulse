import { cn } from "@/lib/cn";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useState } from "react";

interface SchoolBadgeProps {
  name: string;
  badgeUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE = {
  sm: "h-8 w-8 rounded-[9px] text-[11px]",
  md: "h-10 w-10 rounded-[10px] text-[13px]",
  lg: "h-14 w-14 rounded-xl text-[15px]",
  xl: "h-20 w-20 rounded-2xl text-[18px]",
} as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SchoolBadge({ name, badgeUrl, size = "md", className }: SchoolBadgeProps) {
  const src = resolveMediaUrl(badgeUrl);
  const [broken, setBroken] = useState(false);
  const box = SIZE[size];

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} badge`}
        onError={() => setBroken(true)}
        className={cn("shrink-0 object-contain bg-white ring-1 ring-slate-200/80", box, className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 font-display font-semibold text-white shadow-sm shadow-brand-700/20 ring-1 ring-brand-700/10",
        box,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

interface SchoolBrandedHeaderProps {
  name: string;
  motto?: string | null;
  badgeUrl?: string | null;
  subtitle?: string;
  align?: "left" | "center";
  badgeSize?: SchoolBadgeProps["size"];
}

export function SchoolBrandedHeader({
  name,
  motto,
  badgeUrl,
  subtitle,
  align = "left",
  badgeSize = "lg",
}: SchoolBrandedHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex gap-4",
        centered ? "flex-col items-center text-center" : "items-start",
      )}
    >
      <SchoolBadge name={name} badgeUrl={badgeUrl} size={badgeSize} />
      <div className={cn("min-w-0", centered && "flex flex-col items-center")}>
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">{name}</h2>
        {motto ? (
          <p className="mt-0.5 text-sm text-slate-600">{motto}</p>
        ) : null}
        {subtitle ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
