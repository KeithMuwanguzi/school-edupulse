"use client";

import type { ReactNode } from "react";
import { SchoolBadge } from "@/components/domain/school/SchoolBadge";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import type {
  ReportCardAssessmentSet,
  ReportCardPreviewOut,
  ReportCardSubjectLine,
} from "@/lib/types";

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null) return "—";
  return `${value}${suffix}`;
}

function setScore(line: ReportCardSubjectLine, setId: string): number | null {
  const found = line.set_scores.find((s) => s.set_id === setId);
  return found?.score ?? null;
}

function rowTotals(sets: ReportCardAssessmentSet[], lines: ReportCardSubjectLine[]) {
  return sets.map((set) => {
    const scores = lines
      .map((line) => setScore(line, set.set_id))
      .filter((v): v is number => v != null);
    const total = scores.length ? scores.reduce((a, b) => a + b, 0) : null;
    const pcts = lines
      .map((line) => line.set_scores.find((s) => s.set_id === set.set_id)?.percentage)
      .filter((v): v is number => v != null);
    const avg = pcts.length
      ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10
      : null;
    return { set, total, avg };
  });
}

export function ReportCardPreview({ data }: { data: ReportCardPreviewOut }) {
  const studentName = formatStudentFullName({
    last_name: data.student.last_name,
    middle_name: data.student.middle_name,
    first_name: data.student.first_name,
  });
  const classLine = [data.student.class_label, data.student.stream_name]
    .filter(Boolean)
    .join(" · ");
  const isPle = data.assessment_mode === "ple";
  const sets = data.assessment_sets ?? [];
  const lines = data.subject_lines ?? [];
  const hasSetMatrix = sets.length > 0 && data.marks_available;
  const totals = rowTotals(sets, lines);
  const contactBits = [
    data.school.address_line,
    data.school.phone ? `Tel: ${data.school.phone}` : null,
    data.school.email ? `Email: ${data.school.email}` : null,
  ].filter(Boolean);

  return (
    <div className="report-card-page mx-auto w-full max-w-[820px]">
      <article className="report-card-print relative flex min-h-[1120px] flex-col bg-white text-[12px] leading-snug text-slate-900 shadow-xl ring-1 ring-slate-200 print:shadow-none print:ring-0">
        {/* Decorative frame */}
        <div className="pointer-events-none absolute inset-2 rounded-[6px] border-2 border-brand-700/70" />
        <div className="pointer-events-none absolute inset-[14px] rounded-[4px] border border-brand-700/30" />

        <div className="relative flex flex-1 flex-col px-8 py-7">
          {/* Header */}
          <header className="flex items-center gap-4 border-b-2 border-brand-700/80 pb-4">
            <SchoolBadge name={data.school.name} badgeUrl={data.school.badge_url} size="xl" />
            <div className="flex-1 text-center">
              <h1 className="font-serif text-[22px] font-bold uppercase leading-tight tracking-wide text-brand-900">
                {data.school.name}
              </h1>
              {contactBits.length ? (
                <p className="mt-1 text-[10.5px] text-slate-600">{contactBits.join("  •  ")}</p>
              ) : null}
              {data.school.motto ? (
                <p className="mt-1 text-[10.5px] font-medium italic text-brand-700">
                  &ldquo;{data.school.motto}&rdquo;
                </p>
              ) : null}
            </div>
            {/* spacer to balance the badge for centered title */}
            <div className="h-20 w-20 shrink-0" aria-hidden />
          </header>

          <div className="mt-3 flex justify-center">
            <span className="rounded-full border border-brand-700/40 bg-brand-50 px-5 py-1 text-[12px] font-bold uppercase tracking-[0.22em] text-brand-800">
              Terminal Report
            </span>
          </div>

          {/* Pupil identity */}
          <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-md bg-slate-50/80 px-4 py-3 text-[12px]">
            <IdField label="Name" value={studentName} wide />
            <IdField label="Pupil No." value={data.student.student_number} />
            <IdField label="Class" value={classLine || "—"} />
            <IdField label="Section" value={data.level_section} />
            <IdField label="Term" value={`${data.term.label}`} />
            <IdField label="Year" value={data.term.academic_year_label} />
          </section>

          {!data.marks_available ? (
            <p className="mt-4 rounded-md border border-gold-300 bg-gold-50 px-3 py-2 text-[11px] text-gold-800">
              Assessment marks have not been recorded for this term yet. The layout below reflects the
              subjects and assessment sets configured for this class; scores will populate once marks
              are entered.
            </p>
          ) : null}

          {/* Assessment-set matrix */}
          {hasSetMatrix ? (
            <section className="mt-5">
              <SectionTitle>Pupil&apos;s Assessment Record</SectionTitle>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-brand-700 text-white">
                      <th className="border border-brand-800 px-2 py-1.5 text-left font-semibold">
                        Assessment
                      </th>
                      {lines.map((line) => (
                        <th
                          key={line.subject_id}
                          className="border border-brand-800 px-2 py-1.5 text-center font-semibold"
                          title={line.subject_name}
                        >
                          {line.subject_code}
                        </th>
                      ))}
                      <th className="border border-brand-800 px-2 py-1.5 text-center font-semibold">
                        Total
                      </th>
                      <th className="border border-brand-800 px-2 py-1.5 text-center font-semibold">
                        Avg %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map(({ set, total, avg }, idx) => (
                      <tr key={set.set_id} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700">
                          {set.name}
                          <span className="ml-1 font-normal text-slate-400">/{set.max_mark}</span>
                        </td>
                        {lines.map((line) => (
                          <td
                            key={line.subject_id}
                            className="border border-slate-300 px-2 py-1.5 text-center tabular-nums"
                          >
                            {fmt(setScore(line, set.set_id))}
                          </td>
                        ))}
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums">
                          {fmt(total)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums">
                          {fmt(avg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* End of term performance + grading key */}
          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_180px]">
            <div>
              <SectionTitle>End of Term Performance</SectionTitle>
              <table className="mt-2 w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-brand-700 text-white">
                    <th className="border border-brand-800 px-2 py-1.5 text-left font-semibold">
                      Subject
                    </th>
                    <th className="border border-brand-800 px-2 py-1.5 text-center font-semibold">
                      Score %
                    </th>
                    <th className="border border-brand-800 px-2 py-1.5 text-center font-semibold">
                      {isPle ? "Grade" : "Agg"}
                    </th>
                    <th className="border border-brand-800 px-2 py-1.5 text-left font-semibold">
                      Comment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.subject_id} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="border border-slate-300 px-2 py-1.5 font-medium">
                        {line.subject_name}
                        {line.is_core ? (
                          <span className="ml-1 text-[9px] font-semibold uppercase text-brand-600">
                            core
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">
                        {fmt(line.ca_score)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums">
                        {line.grade ?? fmt(line.aggregate_points)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-600">
                        {line.comment ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {data.marks_available ? (
                    <tr className="bg-brand-50 font-semibold">
                      <td className="border border-slate-300 px-2 py-1.5 uppercase tracking-wide">
                        Total
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">
                        {fmt(data.total_marks)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">
                        {fmt(data.total_aggregate ?? data.aggregate)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5" />
                    </tr>
                  ) : null}
                </tbody>
              </table>

              {/* Summary chips */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <SummaryChip label="Average" value={fmt(data.average_score, "%")} />
                <SummaryChip label="Aggregate" value={fmt(data.total_aggregate ?? data.aggregate)} />
                <SummaryChip label="Division" value={data.division_label ?? "—"} highlight />
              </div>
            </div>

            {/* Grading key */}
            <aside className="self-start rounded-md border border-slate-300 bg-slate-50/70 p-3">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-brand-800">
                Grading Key
              </p>
              {data.grading_key.length ? (
                <ul className="space-y-1 text-[10.5px]">
                  {data.grading_key.map((g) => (
                    <li key={g.label} className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">{g.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {g.min_mark}–{g.max_mark}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-[10px] text-slate-400">
                  Configure grading bands in Settings.
                </p>
              )}
              {data.attendance ? (
                <div className="mt-3 border-t border-slate-200 pt-2 text-[10.5px]">
                  <p className="font-semibold text-slate-700">Attendance</p>
                  <p className="text-slate-500">
                    {data.attendance.present_days}/{data.attendance.total_days} days (
                    {data.attendance.percentage}%)
                  </p>
                </div>
              ) : null}
            </aside>
          </section>

          {/* Comments */}
          <section className="mt-5 space-y-2 text-[11.5px]">
            <CommentLine
              role="Class Teacher's Report"
              comment={data.class_teacher_comment}
              status={data.comments_status}
            />
            <CommentLine
              role="Head Teacher's Report"
              comment={data.head_teacher_comment}
              status={data.comments_status}
            />
          </section>

          {/* Footer: next term, fees, requirements */}
          {data.footer &&
          (data.footer.next_term_label ||
            data.footer.next_term_note ||
            data.footer.term_fees_summary ||
            data.footer.requirements_text) ? (
            <section className="mt-5 rounded border border-slate-200 bg-slate-50/60 px-4 py-3 text-[11px] text-slate-700">
              <p className="font-semibold uppercase tracking-wide text-slate-500">Important notes</p>
              <ul className="mt-2 space-y-1.5">
                {data.footer.next_term_label ? (
                  <li>
                    <span className="font-medium">Next term:</span> {data.footer.next_term_label}
                    {data.footer.next_term_starts_on
                      ? ` · starts ${new Date(data.footer.next_term_starts_on).toLocaleDateString()}`
                      : ""}
                    {data.footer.next_term_note ? ` — ${data.footer.next_term_note}` : ""}
                  </li>
                ) : data.footer.next_term_note ? (
                  <li>
                    <span className="font-medium">Next term:</span> {data.footer.next_term_note}
                  </li>
                ) : null}
                {data.footer.term_fees_summary ? (
                  <li>
                    <span className="font-medium">Fees:</span> {data.footer.term_fees_summary}
                  </li>
                ) : null}
                {data.footer.requirements_text ? (
                  <li>
                    <span className="font-medium">Requirements:</span>{" "}
                    {data.footer.requirements_text}
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {/* Footer: signatures + meta */}
          <footer className="mt-auto pt-6">
            <div className="grid grid-cols-2 gap-8 text-[11px]">
              <SignatureLine label="Class Teacher" name={null} />
              <SignatureLine label="Head Teacher" name={data.school.head_teacher_name} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2 text-[9.5px] text-slate-500">
              <span>
                Generated {new Date(data.generated_at).toLocaleDateString()} · This report is invalid
                without the school&apos;s official stamp and signature.
              </span>
              {data.school.motto ? (
                <span className="font-medium italic text-brand-700">
                  &ldquo;{data.school.motto}&rdquo;
                </span>
              ) : null}
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}

function IdField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}:{" "}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-brand-800">{children}</h2>
  );
}

function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        highlight ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-[13px] font-bold text-slate-900">{value}</p>
    </div>
  );
}

function CommentLine({
  role,
  comment,
  status,
}: {
  role: string;
  comment: string | null | undefined;
  status: ReportCardPreviewOut["comments_status"];
}) {
  const fallback =
    status === "pending_marks"
      ? "Awaiting recorded marks."
      : status === "no_scale" || status === "no_band"
        ? "Configure grading bands in Settings → Grading."
        : "—";
  return (
    <div className="flex gap-2">
      <span className="shrink-0 font-bold text-slate-700">{role}:</span>
      <span className="min-h-[1.2em] flex-1 border-b border-dotted border-slate-300 text-slate-700">
        {comment ?? fallback}
      </span>
    </div>
  );
}

function SignatureLine({ label, name }: { label: string; name: string | null | undefined }) {
  return (
    <div>
      <div className="h-8 border-b border-slate-400" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {name ? <span className="ml-1 normal-case text-slate-700">· {name}</span> : null}
      </p>
    </div>
  );
}
