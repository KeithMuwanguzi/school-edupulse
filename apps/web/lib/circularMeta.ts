import type { CircularAudience, CircularPriority, CircularStatus } from "@/lib/types";

export const CIRCULAR_AUDIENCE_OPTIONS: {
  id: CircularAudience;
  label: string;
  hint: string;
}[] = [
  {
    id: "all_parents",
    label: "All parents",
    hint: "Whole-school notice — fees, closures, general updates.",
  },
  {
    id: "class",
    label: "One class",
    hint: "P.5 only, Baby class only, etc.",
  },
  {
    id: "stream",
    label: "One stream",
    hint: "P.7 North, P.3 East — smallest targeted group.",
  },
];

export const CIRCULAR_STATUS_LABEL: Record<CircularStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const CIRCULAR_PRIORITY_LABEL: Record<CircularPriority, string> = {
  normal: "Routine",
  important: "Important",
};

export function circularAudienceLabel(
  audience: CircularAudience,
  classLabel?: string | null,
  streamLabel?: string | null,
): string {
  if (audience === "all_parents") return "All parents";
  if (audience === "class" && classLabel) return classLabel;
  if (audience === "stream" && classLabel && streamLabel) return `${classLabel} · ${streamLabel}`;
  return CIRCULAR_AUDIENCE_OPTIONS.find((o) => o.id === audience)?.label ?? audience;
}

export const CIRCULAR_BEST_PRACTICES = [
  {
    title: "One place for parents",
    body: "Publish here first. Parents check the portal inbox — avoid repeating the same notice across WhatsApp, paper, and email.",
  },
  {
    title: "Lead with what matters",
    body: "Put the date, action required, or deadline in the title and first sentence. Parents scan on mobile.",
  },
  {
    title: "Target the right group",
    body: "Use class or stream when only some families need the update. Whole-school blasts create noise.",
  },
  {
    title: "Use Important sparingly",
    body: "Reserve the Important flag for closures, safety, or same-day changes — not routine reminders.",
  },
  {
    title: "Keep a searchable archive",
    body: "Published circulars stay in the inbox. Archive old items to tidy admin view without deleting history.",
  },
] as const;
