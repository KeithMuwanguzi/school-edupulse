import type { HostelGender } from "@/lib/types";

export const HOSTEL_GENDER_OPTIONS: { value: HostelGender; label: string }[] = [
  { value: "mixed", label: "Mixed" },
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
];

export function genderLabel(gender: HostelGender): string {
  return HOSTEL_GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? gender;
}

export function genderTone(gender: HostelGender): "blue" | "gold" | "neutral" {
  if (gender === "boys") return "blue";
  if (gender === "girls") return "gold";
  return "neutral";
}

/** Tailwind classes for an occupancy progress bar based on how full it is. */
export function occupancyBarTone(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 85) return "bg-amber-500";
  return "bg-brand-500";
}

export function occupancyLabel(
  occupied: number,
  capacity: number | null | undefined,
): string {
  if (capacity == null) return `${occupied} resident${occupied === 1 ? "" : "s"}`;
  return `${occupied} / ${capacity}`;
}
