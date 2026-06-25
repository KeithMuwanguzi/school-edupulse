import type { RosterScope, RosterSummaryOut, RegisteredRosterSummaryOut } from "@/lib/types";

export function defaultRosterScope(summary: RosterSummaryOut | undefined): RosterScope | null {
  if (!summary) return null;
  if (summary.total > 0) return { kind: "overview" };
  return null;
}

/** Teachers land on their first assigned class instead of the school-wide overview. */
export function defaultTeacherRosterScope(summary: RosterSummaryOut | undefined): RosterScope | null {
  if (!summary || summary.classes.length === 0) return null;
  for (const cls of summary.classes) {
    const hasLearners =
      cls.count > 0 || cls.streams.some((stream) => stream.count > 0);
    if (!hasLearners) continue;
    if (cls.streams.length > 0) {
      const stream = cls.streams.find((s) => s.count > 0) ?? cls.streams[0];
      return { kind: "stream", classId: cls.class_id, streamId: stream.stream_id };
    }
    return { kind: "class", classId: cls.class_id };
  }
  const first = summary.classes[0];
  if (first.streams.length > 0) {
    return {
      kind: "stream",
      classId: first.class_id,
      streamId: first.streams[0].stream_id,
    };
  }
  return { kind: "class", classId: first.class_id };
}

export function scopeLabel(scope: RosterScope, summary: RosterSummaryOut | undefined): string {
  if (scope.kind === "overview") return "Overview";
  if (scope.kind === "unassigned") return "Unassigned";
  const cls = summary?.classes.find((c) => c.class_id === scope.classId);
  if (!cls) return "Class";
  if (scope.kind === "stream") {
    const stream = cls.streams.find((s) => s.stream_id === scope.streamId);
    return stream ? `${cls.level} · ${stream.name}` : cls.level;
  }
  return cls.label ? `${cls.level} (${cls.label})` : cls.level;
}

export function scopeToListParams(scope: RosterScope, q?: string) {
  if (scope.kind === "overview") return undefined;
  const base = { limit: 100, q: q || undefined };
  if (scope.kind === "unassigned") return { ...base, unassigned: true };
  if (scope.kind === "stream") {
    return { ...base, classId: scope.classId, streamId: scope.streamId };
  }
  return { ...base, classId: scope.classId };
}

/** First class/stream with learners — used as the default registration queue scope. */
export function defaultRegistrationScope(
  summary: RosterSummaryOut | undefined,
): RosterScope | null {
  if (!summary) return null;
  for (const cls of summary.classes) {
    if (cls.count === 0) continue;
    if (cls.streams.length > 0) {
      const stream = cls.streams.find((s) => s.count > 0) ?? cls.streams[0];
      return { kind: "stream", classId: cls.class_id, streamId: stream.stream_id };
    }
    return { kind: "class", classId: cls.class_id };
  }
  if (summary.unassigned > 0) return { kind: "unassigned" };
  return null;
}

export function registrationScopeToQueueParams(scope: RosterScope, q?: string, status?: string) {
  const base = { q: q || undefined, status: status || undefined };
  if (scope.kind === "unassigned") return { ...base, unassigned: true };
  if (scope.kind === "stream") {
    return { ...base, classId: scope.classId, streamId: scope.streamId };
  }
  if (scope.kind === "class") return { ...base, classId: scope.classId };
  return undefined;
}

export function scopesEqual(a: RosterScope | null, b: RosterScope | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "overview" || a.kind === "unassigned") return true;
  if (b.kind === "unassigned") return false;
  if (a.kind === "class" && b.kind === "class") return a.classId === b.classId;
  if (a.kind === "stream" && b.kind === "stream") {
    return a.classId === b.classId && a.streamId === b.streamId;
  }
  return false;
}

/** Map term-registered counts to the shape ClassStreamNavigator expects. */
export function registeredSummaryToNavSummary(
  summary: RegisteredRosterSummaryOut | undefined,
): RosterSummaryOut | undefined {
  if (!summary) return undefined;
  return {
    total: summary.total_registered,
    unassigned: summary.unassigned,
    classes: summary.classes,
  };
}

export function defaultRegisteredScope(
  summary: RegisteredRosterSummaryOut | undefined,
): RosterScope | null {
  return defaultRegistrationScope(registeredSummaryToNavSummary(summary));
}

export function registeredScopeToListParams(scope: RosterScope, q?: string) {
  const base = { limit: 100, q: q || undefined };
  if (scope.kind === "unassigned") return { ...base, unassigned: true };
  if (scope.kind === "stream") {
    return { ...base, classId: scope.classId, streamId: scope.streamId };
  }
  if (scope.kind === "class") return { ...base, classId: scope.classId };
  return undefined;
}
