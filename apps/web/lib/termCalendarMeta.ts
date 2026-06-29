export type TermCalendarEventType =
  | "short_holiday"
  | "visitation"
  | "class_meeting"
  | "sports_day"
  | "exam_period"
  | "opening_day"
  | "closing_day"
  | "other";

export const TERM_CALENDAR_EVENT_OPTIONS: {
  id: TermCalendarEventType;
  label: string;
  dot: string;
  soft: string;
}[] = [
  { id: "short_holiday", label: "Short holiday", dot: "bg-amber-500", soft: "bg-amber-50 text-amber-900" },
  { id: "visitation", label: "Visitation day", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-900" },
  { id: "class_meeting", label: "Class meeting", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-900" },
  { id: "sports_day", label: "Sports day", dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-900" },
  { id: "exam_period", label: "Exam period", dot: "bg-rose-500", soft: "bg-rose-50 text-rose-900" },
  { id: "opening_day", label: "Opening day", dot: "bg-teal-500", soft: "bg-teal-50 text-teal-900" },
  { id: "closing_day", label: "Closing day", dot: "bg-slate-600", soft: "bg-slate-100 text-slate-800" },
  { id: "other", label: "Other", dot: "bg-slate-400", soft: "bg-slate-50 text-slate-700" },
];

export function termCalendarEventMeta(type: string) {
  return TERM_CALENDAR_EVENT_OPTIONS.find((o) => o.id === type) ?? TERM_CALENDAR_EVENT_OPTIONS.at(-1)!;
}
