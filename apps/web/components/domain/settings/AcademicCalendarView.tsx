"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { PageToolbar, PageToolbarGroup } from "@/components/ui/PageToolbar";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { useToast } from "@/components/ui/Toast";
import {
  dayTermMarkers,
  daysInMonth,
  eventsOnDay,
  firstWeekday,
  formatDisplayDate,
  formatShortDate,
  MONTHS,
  parseIsoDate,
  termProgress,
  TERM_PALETTE,
  type TermRangeMarker,
} from "@/lib/calendarUtils";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { termCalendarEventMeta } from "@/lib/termCalendarMeta";
import type { AcademicYearWithTerms, TermCalendarEventOut, TermOut } from "@/lib/types";
import {
  useActivateAcademicYearMutation,
  useActivateTermMutation,
  useCreateAcademicYearMutation,
  useListAcademicYearsQuery,
  useListTermCalendarEventsQuery,
  useUpdateAcademicYearMutation,
  useUpdateTermMutation,
} from "@/store/api/skulpulseApi";
import { TermCalendarSection } from "@/components/domain/settings/TermCalendarSection";

function termPalette(termNumber: number) {
  return TERM_PALETTE[(termNumber - 1) % TERM_PALETTE.length];
}

/** Mobile-friendly term list (replaces the 12-month mini calendar grid on small screens). */
function YearTermAgenda({ terms }: { terms: TermOut[] }) {
  const today = new Date();

  return (
    <div className="space-y-2">
      {terms.map((term) => {
        const palette = termPalette(term.term_number);
        const start = parseIsoDate(term.starts_on);
        const end = parseIsoDate(term.ends_on);
        const isActive = term.status === "active";
        const inRange =
          start && end && today >= start && today <= end && isActive;
        const progress = termProgress(term.starts_on, term.ends_on);

        return (
          <div
            key={term.id}
            className={cn(
              "rounded-lg border bg-white p-3 shadow-card",
              isActive ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200",
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 h-8 w-1 shrink-0 rounded-full", palette.bar)} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-semibold text-slate-900">{term.label}</h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDisplayDate(term.starts_on)} – {formatDisplayDate(term.ends_on)}
                    </p>
                  </div>
                  <Badge tone={isActive ? "green" : term.status === "upcoming" ? "blue" : "neutral"}>
                    {term.status}
                  </Badge>
                </div>
                {inRange && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Term progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all", palette.bar)}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function YearMiniCalendar({
  yearLabel,
  terms,
  events = [],
}: {
  yearLabel: string;
  terms: TermOut[];
  events?: TermCalendarEventOut[];
}) {
  const calendarYear = Number.parseInt(yearLabel, 10) || new Date().getFullYear();
  const today = new Date();

  const termRanges = useMemo(
    (): TermRangeMarker<TermOut>[] =>
      terms.map((t) => ({
        term: t,
        start: parseIsoDate(t.starts_on),
        end: parseIsoDate(t.ends_on),
        palette: termPalette(t.term_number),
      })),
    [terms],
  );

  function dayTitle(
    markers: ReturnType<typeof dayTermMarkers<TermOut>>,
    dayEvents: TermCalendarEventOut[],
  ): string | undefined {
    const parts: string[] = [];
    if (markers.starts.length) {
      parts.push(
        ...markers.starts.map((r) => `${r.term.label} starts (${formatShortDate(r.term.starts_on)})`),
      );
    }
    if (markers.ends.length) {
      parts.push(
        ...markers.ends.map((r) => `${r.term.label} ends (${formatShortDate(r.term.ends_on)})`),
      );
    }
    if (markers.inRange && !markers.starts.length && !markers.ends.length) {
      parts.push(
        `${markers.inRange.term.label}: ${formatShortDate(markers.inRange.term.starts_on)} – ${formatShortDate(markers.inRange.term.ends_on)}`,
      );
    }
    if (dayEvents.length) {
      parts.push(
        ...dayEvents.map(
          (e) =>
            `${termCalendarEventMeta(e.event_type).label}: ${e.title} (${formatShortDate(e.starts_on)}${e.ends_on !== e.starts_on ? ` – ${formatShortDate(e.ends_on)}` : ""})`,
        ),
      );
    }
    return parts.length ? parts.join(" · ") : undefined;
  }

  return (
    <div className="space-y-3">
      <div className="hidden flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 md:flex">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-4 w-4 items-center justify-center rounded bg-brand-50 text-[8px] text-brand-800">
            1
            <span className="absolute left-0 top-0 h-1 w-1 rounded-full bg-brand-500" />
          </span>
          Term start
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-4 w-4 items-center justify-center rounded bg-brand-50 text-[8px] text-brand-800">
            1
            <span className="absolute bottom-0 right-0 h-1 w-1 rounded-full bg-brand-500" />
          </span>
          Term end
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 w-4 rounded bg-brand-50 ring-1 ring-inset ring-brand-200" />
          Term dates (incl. closed)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 w-4 rounded ring-2 ring-brand-500 ring-offset-1" />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-4 w-4 items-center justify-center rounded bg-slate-50 text-[8px] text-slate-600">
            1
            <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-500" />
          </span>
          Programme event
        </span>
      </div>

      <div className="hidden gap-3 sm:grid-cols-2 md:grid xl:grid-cols-3 2xl:grid-cols-4">
      {MONTHS.map((label, monthIndex) => {
        const dim = daysInMonth(calendarYear, monthIndex);
        const offset = firstWeekday(calendarYear, monthIndex);
        const cells = Array.from({ length: offset + dim }, (_, i) =>
          i < offset ? null : i - offset + 1,
        );

        return (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-800">{label}</span>
              <span className="text-[10px] tabular-nums text-slate-400">{calendarYear}</span>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium text-slate-400">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`${label}-${d}-${i}`}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (day === null) return <span key={`e-${label}-${idx}`} />;
                const date = new Date(calendarYear, monthIndex, day);
                const markers = dayTermMarkers(date, termRanges);
                const dayEvents = eventsOnDay(date, events);
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();
                const inRange = markers.inRange;
                const isActiveTerm = inRange?.term.status === "active";
                const isClosedTerm = inRange?.term.status === "closed";
                const hasMarker =
                  Boolean(inRange) ||
                  markers.starts.length > 0 ||
                  markers.ends.length > 0 ||
                  dayEvents.length > 0;

                return (
                  <span
                    key={`${label}-${day}`}
                    title={dayTitle(markers, dayEvents)}
                    className={cn(
                      "relative flex h-6 items-center justify-center rounded text-[10px] font-medium",
                      inRange && inRange.palette.soft,
                      isClosedTerm && "opacity-95",
                      isActiveTerm && "font-semibold ring-1 ring-inset ring-slate-300/60",
                      !hasMarker && "text-slate-500",
                      isToday && "ring-2 ring-brand-500 ring-offset-1",
                    )}
                  >
                    {day}
                    {markers.starts.map((r) => (
                      <span
                        key={`start-${r.term.id}`}
                        aria-hidden
                        className={cn(
                          "absolute left-0.5 top-0.5 h-1 w-1 rounded-full ring-1 ring-white/80",
                          r.palette.dot,
                        )}
                      />
                    ))}
                    {markers.ends.map((r) => (
                      <span
                        key={`end-${r.term.id}`}
                        aria-hidden
                        className={cn(
                          "absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full ring-1 ring-white/80",
                          r.palette.dot,
                        )}
                      />
                    ))}
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <span
                        key={ev.id}
                        aria-hidden
                        className={cn(
                          "absolute bottom-0 h-1 w-1 rounded-full ring-1 ring-white/80",
                          termCalendarEventMeta(ev.event_type).dot,
                        )}
                        style={{ left: `calc(50% + ${(i - (Math.min(dayEvents.length, 3) - 1) / 2) * 4}px)` }}
                      />
                    ))}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function TermTimeline({
  yearLabel,
  terms,
}: {
  yearLabel: string;
  terms: TermOut[];
}) {
  const calendarYear = Number.parseInt(yearLabel, 10) || new Date().getFullYear();
  const yearStart = new Date(calendarYear, 0, 1);
  const yearEnd = new Date(calendarYear, 11, 31);
  const totalMs = yearEnd.getTime() - yearStart.getTime();

  return (
    <div>
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative min-w-[280px] h-12 rounded-lg border border-slate-200 bg-slate-50/80">
          <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
          {terms.map((term) => {
          const start = parseIsoDate(term.starts_on);
          const end = parseIsoDate(term.ends_on);
          if (!start || !end) return null;
          const left = ((start.getTime() - yearStart.getTime()) / totalMs) * 100;
          const width = ((end.getTime() - start.getTime()) / totalMs) * 100;
          const palette = termPalette(term.term_number);
          return (
            <div
              key={term.id}
              title={`${term.label}: ${formatDisplayDate(term.starts_on)} – ${formatDisplayDate(term.ends_on)}`}
              className={cn(
                "absolute top-2 h-8 rounded-md px-2 text-[10px] font-semibold leading-8 text-white shadow-sm",
                palette.bar,
                term.status === "active" && "ring-2 ring-brand-500 ring-offset-1",
              )}
              style={{
                left: `${Math.max(0, left)}%`,
                width: `${Math.min(100 - left, Math.max(width, 5))}%`,
              }}
            >
              <span className="truncate">{term.label}</span>
            </div>
          );
        })}
        <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] text-slate-400">
          <span>Jan</span>
          <span>Jun</span>
          <span>Dec</span>
        </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {terms.map((t) => {
          const p = termPalette(t.term_number);
          return (
            <span key={t.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className={cn("h-2 w-2 rounded-full", p.dot)} />
              {t.label}
              {t.status === "active" && (
                <span className="font-medium text-brand-700">· active</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TermCard({
  year,
  term,
}: {
  year: AcademicYearWithTerms;
  term: TermOut;
}) {
  const { toast } = useToast();
  const palette = termPalette(term.term_number);
  const [starts, setStarts] = useState(term.starts_on ?? "");
  const [ends, setEnds] = useState(term.ends_on ?? "");
  const [updateTerm, { isLoading: saving }] = useUpdateTermMutation();
  const [activateTerm, { isLoading: activating }] = useActivateTermMutation();
  const progress = termProgress(term.starts_on, term.ends_on);
  const isActive = term.status === "active";

  async function saveDates() {
    try {
      await updateTerm({
        yearId: year.id,
        termId: term.id,
        body: { starts_on: starts || null, ends_on: ends || null },
      }).unwrap();
      toast("Term dates saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function setActive() {
    try {
      await activateTerm({ yearId: year.id, termId: term.id }).unwrap();
      toast(`${term.label} is now active.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 shadow-card",
        isActive ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn("mt-0.5 h-10 w-1 shrink-0 rounded-full", palette.bar)}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-[13px] font-semibold text-slate-900">{term.label}</h4>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatDisplayDate(term.starts_on)} – {formatDisplayDate(term.ends_on)}
              </p>
            </div>
            <Badge tone={isActive ? "green" : term.status === "upcoming" ? "blue" : "neutral"}>
              {term.status}
            </Badge>
          </div>

          {(isActive || term.status === "closed") && term.starts_on && term.ends_on && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Term progress</span>
                <span>{isActive ? `${progress}%` : term.status === "closed" ? "Complete" : ""}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full transition-all", palette.bar)}
                  style={{
                    width: `${isActive ? progress : term.status === "closed" ? 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <FormField label="Starts">
              <Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
            </FormField>
            <FormField label="Ends">
              <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
            </FormField>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={saving} onClick={saveDates}>
              Save dates
            </Button>
            {!isActive && (
              <Button size="sm" variant="ghost" loading={activating} onClick={setActive}>
                Set active
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function YearWorkspace({ year }: { year: AcademicYearWithTerms }) {
  const { toast } = useToast();
  const [activateYear, { isLoading: activating }] = useActivateAcademicYearMutation();
  const [updateYear, { isLoading: savingYear }] = useUpdateAcademicYearMutation();
  const [yearStarts, setYearStarts] = useState(year.starts_on ?? "");
  const [yearEnds, setYearEnds] = useState(year.ends_on ?? "");
  const activeTerm = year.terms.find((t) => t.status === "active");
  const { data: calendarEvents = [] } = useListTermCalendarEventsQuery({ yearId: year.id });

  useEffect(() => {
    setYearStarts(year.starts_on ?? "");
    setYearEnds(year.ends_on ?? "");
  }, [year.id, year.starts_on, year.ends_on]);

  async function saveYearDates() {
    try {
      await updateYear({
        yearId: year.id,
        body: {
          starts_on: yearStarts || null,
          ends_on: yearEnds || null,
        },
      }).unwrap();
      toast("Academic year dates saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function setYearActive() {
    try {
      await activateYear(year.id).unwrap();
      toast(`${year.label} is now the active academic year.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`Academic year ${year.label}`}
          description={
            activeTerm
              ? `${activeTerm.label} is the current term.`
              : "Choose an active term below when you are ready to start."
          }
          action={
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <StatusBadge status={year.status} />
              {year.status !== "active" && (
                <Button size="sm" variant="secondary" loading={activating} onClick={setYearActive}>
                  Set active year
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-md">
            <FormField label="Year starts">
              <Input type="date" value={yearStarts} onChange={(e) => setYearStarts(e.target.value)} />
            </FormField>
            <FormField label="Year ends">
              <Input type="date" value={yearEnds} onChange={(e) => setYearEnds(e.target.value)} />
            </FormField>
          </div>
          <Button size="sm" variant="secondary" loading={savingYear} onClick={() => void saveYearDates()}>
            Save year dates
          </Button>
          <p className="mb-2 text-[11px] font-medium text-slate-500">Year overview</p>
          <TermTimeline yearLabel={year.label} terms={year.terms} />
        </CardBody>
      </Card>

      <div>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-800">Manage terms</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {year.terms.map((term) => (
            <TermCard key={term.id} year={year} term={term} />
          ))}
        </div>
      </div>

      <TermCalendarSection yearId={year.id} terms={year.terms} />

      <Card>
        <CardHeader
          title="Calendar view"
          description={`Term dates and programme events across ${year.label}. Today is highlighted.`}
        />
        <CardBody>
          <div className="md:hidden">
            <YearTermAgenda terms={year.terms} />
          </div>
          <div className="hidden md:block">
            <YearMiniCalendar yearLabel={year.label} terms={year.terms} events={calendarEvents} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function AcademicCalendarView() {
  const { toast } = useToast();
  const { data: years, isLoading, isError, refetch, isFetching } = useListAcademicYearsQuery();
  const [createYear, { isLoading: creating }] = useCreateAcademicYearMutation();
  const [newLabel, setNewLabel] = useState(String(new Date().getFullYear() + 1));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sortedYears = useMemo(
    () => [...(years ?? [])].sort((a, b) => b.label.localeCompare(a.label)),
    [years],
  );

  const activeYear = sortedYears.find((y) => y.status === "active");
  const selected =
    sortedYears.find((y) => y.id === selectedId) ?? activeYear ?? sortedYears[0] ?? null;

  async function addYear() {
    try {
      await createYear({ label: newLabel.trim() }).unwrap();
      toast(`Academic year ${newLabel} created with 3 terms.`, "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError || !years) return <ErrorBanner message="Unable to load academic calendar." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max gap-1.5">
            {sortedYears.map((y) => (
              <button
                key={y.id}
                type="button"
                onClick={() => setSelectedId(y.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition",
                  selected?.id === y.id
                    ? "border-brand-300 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {y.label}
                {y.status === "active" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" title="Active year" />
                )}
              </button>
            ))}
          </div>
        </div>
        <PageToolbar className="sm:justify-between">
          <PageToolbarGroup className="w-full sm:max-w-xs">
            <FormField label="New year" required>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="2027"
                maxLength={4}
              />
            </FormField>
          </PageToolbarGroup>
          <PageToolbarGroup>
            <Button size="sm" loading={creating} onClick={addYear}>
              <Icon name="plus" size={13} />
              Add year
            </Button>
            <RefreshButton onRefresh={refetch} isRefreshing={isFetching} label="Refresh calendar" />
          </PageToolbarGroup>
        </PageToolbar>
      </div>

      {sortedYears.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" size={18} />}
          title="No academic years yet"
          description="Add a year above — the MoES three-term structure is created automatically."
        />
      ) : (
        selected && <YearWorkspace year={selected} />
      )}
    </div>
  );
}
