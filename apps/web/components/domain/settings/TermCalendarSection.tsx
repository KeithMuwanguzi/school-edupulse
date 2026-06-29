"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import { formatDisplayDate } from "@/lib/calendarUtils";
import {
  TERM_CALENDAR_EVENT_OPTIONS,
  termCalendarEventMeta,
  type TermCalendarEventType,
} from "@/lib/termCalendarMeta";
import type { TermCalendarEventOut, TermOut } from "@/lib/types";
import {
  useCreateTermCalendarEventMutation,
  useDeleteTermCalendarEventMutation,
  useListTermCalendarEventsQuery,
  useUpdateTermCalendarEventMutation,
} from "@/store/api/skulpulseApi";

const EMPTY_FORM = {
  event_type: "short_holiday" as TermCalendarEventType,
  title: "",
  starts_on: "",
  ends_on: "",
  description: "",
};

function EventRow({
  yearId,
  event,
}: {
  yearId: string;
  event: TermCalendarEventOut;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    event_type: event.event_type,
    title: event.title,
    starts_on: event.starts_on,
    ends_on: event.ends_on,
    description: event.description ?? "",
  });
  const [updateEvent, { isLoading: saving }] = useUpdateTermCalendarEventMutation();
  const [deleteEvent] = useDeleteTermCalendarEventMutation();
  const meta = termCalendarEventMeta(event.event_type);

  async function save() {
    try {
      await updateEvent({
        yearId,
        termId: event.term_id,
        eventId: event.id,
        body: {
          event_type: draft.event_type,
          title: draft.title.trim(),
          starts_on: draft.starts_on,
          ends_on: draft.ends_on,
          description: draft.description.trim() || null,
        },
      }).unwrap();
      toast("Event updated.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Remove event",
      description: `Remove "${event.title}" from the term calendar?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteEvent({ yearId, termId: event.term_id, eventId: event.id }).unwrap();
      toast("Event removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50/50 align-top">
        <td className="px-3 py-2">
          <Select
            value={draft.event_type}
            onChange={(e) =>
              setDraft((d) => ({ ...d, event_type: e.target.value as TermCalendarEventType }))
            }
            className="min-w-[9rem] text-[12px]"
          >
            {TERM_CALENDAR_EVENT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </td>
        <td className="px-3 py-2">
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="text-[12px]"
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            <Input
              type="date"
              value={draft.starts_on}
              onChange={(e) => setDraft((d) => ({ ...d, starts_on: e.target.value }))}
              className="text-[12px]"
            />
            <Input
              type="date"
              value={draft.ends_on}
              onChange={(e) => setDraft((d) => ({ ...d, ends_on: e.target.value }))}
              className="text-[12px]"
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <Input
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional notes"
            className="text-[12px]"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-50 align-top">
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium",
            meta.soft,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] font-medium text-slate-800">{event.title}</td>
      <td className="px-3 py-2.5 text-[11px] text-slate-600">
        {formatDisplayDate(event.starts_on)}
        {event.ends_on !== event.starts_on ? ` – ${formatDisplayDate(event.ends_on)}` : ""}
      </td>
      <td className="px-3 py-2.5 text-[11px] text-slate-500">{event.description || "—"}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function TermCalendarSection({
  yearId,
  terms,
}: {
  yearId: string;
  terms: TermOut[];
}) {
  const { toast } = useToast();
  const activeTerm = terms.find((t) => t.status === "active") ?? terms[0];
  const [termId, setTermId] = useState(activeTerm?.id ?? "");
  const [form, setForm] = useState(EMPTY_FORM);
  const [createEvent, { isLoading: creating }] = useCreateTermCalendarEventMutation();

  const { data: allEvents = [], isLoading } = useListTermCalendarEventsQuery({ yearId });

  const termEvents = useMemo(
    () =>
      allEvents
        .filter((e) => e.term_id === termId)
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.title.localeCompare(b.title)),
    [allEvents, termId],
  );

  const selectedTerm = terms.find((t) => t.id === termId);

  async function addEvent() {
    if (!termId || !form.title.trim() || !form.starts_on || !form.ends_on) {
      toast("Title and dates are required.", "error");
      return;
    }
    try {
      await createEvent({
        yearId,
        termId,
        body: {
          event_type: form.event_type,
          title: form.title.trim(),
          starts_on: form.starts_on,
          ends_on: form.ends_on,
          description: form.description.trim() || null,
        },
      }).unwrap();
      toast("Event added to term calendar.", "success");
      setForm(EMPTY_FORM);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Icon name="calendar" size={13} />}
        title="Term calendar"
        description="Plan visitations, sports days, short holidays, exams, and the rest of the school programme."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <button
              key={term.id}
              type="button"
              onClick={() => setTermId(term.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                termId === term.id
                  ? "border-brand-300 bg-brand-50 text-brand-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {term.label}
              {term.status === "active" ? <Badge tone="green">Active</Badge> : null}
            </button>
          ))}
        </div>

        {selectedTerm ? (
          <p className="text-[11px] text-slate-500">
            {selectedTerm.label}: {formatDisplayDate(selectedTerm.starts_on)} –{" "}
            {formatDisplayDate(selectedTerm.ends_on)}. Events must fall within these dates.
          </p>
        ) : null}

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-3">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Add programme item
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Type">
              <Select
                value={form.event_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, event_type: e.target.value as TermCalendarEventType }))
                }
              >
                {TERM_CALENDAR_EVENT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. P.7 visitation"
              />
            </FormField>
            <FormField label="Starts" required>
              <Input
                type="date"
                value={form.starts_on}
                onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
              />
            </FormField>
            <FormField label="Ends" required>
              <Input
                type="date"
                value={form.ends_on}
                onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Notes">
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional details for staff and parents"
              />
            </FormField>
          </div>
          <Button size="sm" className="mt-3" loading={creating} onClick={() => void addEvent()}>
            <Icon name="plus" size={13} />
            Add to calendar
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-500">
                    Loading calendar…
                  </td>
                </tr>
              ) : termEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-500">
                    No events for this term yet. Add visitations, holidays, and sports days above.
                  </td>
                </tr>
              ) : (
                termEvents.map((event) => (
                  <EventRow key={event.id} yearId={yearId} event={event} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
          {TERM_CALENDAR_EVENT_OPTIONS.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", o.dot)} />
              {o.label}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export type { TermCalendarEventOut };
