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
    <div className="report-card-page">
      <article className="report-card-print">
        <div className="report-card-frame" aria-hidden />

        <div className="report-card-body">
          {/* Header — symmetric crest + identity */}
          <header className="report-card-header">
            <SchoolBadge name={data.school.name} badgeUrl={data.school.badge_url} size="lg" />
            <div className="report-card-header-text">
              <h1 className="report-card-school-name">{data.school.name}</h1>
              {contactBits.length ? (
                <div className="report-card-contact">
                  {contactBits.map((bit) => (
                    <span key={bit}>{bit}</span>
                  ))}
                </div>
              ) : null}
              {data.school.motto ? (
                <p className="report-card-motto">&ldquo;{data.school.motto}&rdquo;</p>
              ) : null}
            </div>
            <div className="report-card-header-crest" aria-hidden>
              <SchoolBadge name={data.school.name} badgeUrl={data.school.badge_url} size="lg" />
            </div>
          </header>

          <div className="report-card-title-band">
            <span>Terminal Report</span>
          </div>

          {/* Learner identity — formal definition grid */}
          <section className="report-card-identity">
            <div className="report-card-identity-row report-card-identity-row--wide">
              <span className="report-card-identity-label">Name</span>
              <span className="report-card-identity-value">{studentName}</span>
            </div>
            <div className="report-card-identity-grid">
              <div className="report-card-identity-row">
                <span className="report-card-identity-label">Pupil No.</span>
                <span className="report-card-identity-value">{data.student.student_number}</span>
              </div>
              <div className="report-card-identity-row">
                <span className="report-card-identity-label">Class</span>
                <span className="report-card-identity-value">{classLine || "—"}</span>
              </div>
              <div className="report-card-identity-row">
                <span className="report-card-identity-label">Section</span>
                <span className="report-card-identity-value">{data.level_section}</span>
              </div>
              <div className="report-card-identity-row">
                <span className="report-card-identity-label">Term</span>
                <span className="report-card-identity-value">{data.term.label}</span>
              </div>
              <div className="report-card-identity-row">
                <span className="report-card-identity-label">Year</span>
                <span className="report-card-identity-value">{data.term.academic_year_label}</span>
              </div>
            </div>
          </section>

          {!data.marks_available ? (
            <p className="report-card-notice">
              Assessment marks have not been recorded for this term. Scores will appear once marks
              are entered under Assessment.
            </p>
          ) : null}

          {hasSetMatrix ? (
            <section className="report-card-section">
              <SectionTitle>Pupil&apos;s assessment record</SectionTitle>
              <table className="report-card-table report-card-table--compact">
                <thead>
                  <tr>
                    <th className="report-card-table-sticky">Assessment</th>
                    {lines.map((line) => (
                      <th key={line.subject_id} title={line.subject_name}>
                        {line.subject_code}
                      </th>
                    ))}
                    <th>Total</th>
                    <th>Avg %</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map(({ set, total, avg }) => (
                    <tr key={set.set_id}>
                      <td className="report-card-table-sticky">
                        {set.name}
                        <span className="report-card-muted"> /{set.max_mark}</span>
                      </td>
                      {lines.map((line) => (
                        <td key={line.subject_id} className="report-card-num">
                          {fmt(setScore(line, set.set_id))}
                        </td>
                      ))}
                      <td className="report-card-num report-card-strong">{fmt(total)}</td>
                      <td className="report-card-num report-card-strong">{fmt(avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="report-card-section report-card-performance">
            <div className="report-card-performance-main">
              <SectionTitle>End of term performance</SectionTitle>
              <table className="report-card-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Score %</th>
                    <th>{isPle ? "Grade" : "Agg"}</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.subject_id}>
                      <td>
                        {line.subject_name}
                        {line.is_core ? (
                          <span className="report-card-core-tag">core</span>
                        ) : null}
                      </td>
                      <td className="report-card-num">{fmt(line.ca_score)}</td>
                      <td className="report-card-num report-card-strong">
                        {line.grade ?? fmt(line.aggregate_points)}
                      </td>
                      <td className="report-card-comment-cell">{line.comment ?? "—"}</td>
                    </tr>
                  ))}
                  {data.marks_available ? (
                    <tr className="report-card-total-row">
                      <td>Total</td>
                      <td className="report-card-num">{fmt(data.total_marks)}</td>
                      <td className="report-card-num">
                        {fmt(data.total_aggregate ?? data.aggregate)}
                      </td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>

              {data.marks_available ? (
                <div className="report-card-summary-bar">
                  <SummaryStat label="Average" value={fmt(data.average_score, "%")} />
                  <SummaryStat label="Aggregate" value={fmt(data.total_aggregate ?? data.aggregate)} />
                  <SummaryStat label="Division" value={data.division_label ?? "—"} emphasis />
                </div>
              ) : null}
            </div>

            <aside className="report-card-sidebar">
              <p className="report-card-sidebar-title">Grading key</p>
              {data.grading_key.length ? (
                <ul className="report-card-grading-list">
                  {data.grading_key.map((g) => (
                    <li key={g.label}>
                      <span>{g.label}</span>
                      <span className="report-card-num">
                        {g.min_mark}–{g.max_mark}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="report-card-muted">Configure bands in Settings → Grading.</p>
              )}
              {data.attendance ? (
                <div className="report-card-attendance">
                  <p className="report-card-sidebar-subtitle">Attendance</p>
                  <p className="report-card-muted">
                    {data.attendance.present_days}/{data.attendance.total_days} days ·{" "}
                    {data.attendance.percentage}%
                  </p>
                </div>
              ) : null}
            </aside>
          </section>

          <section className="report-card-section report-card-comments">
            <CommentBlock
              role="Class teacher"
              comment={data.class_teacher_comment}
              status={data.comments_status}
            />
            <CommentBlock
              role="Head teacher"
              comment={data.head_teacher_comment}
              status={data.comments_status}
            />
          </section>

          {data.footer &&
          (data.footer.next_term_label ||
            data.footer.next_term_note ||
            data.footer.term_fees_summary ||
            data.footer.requirements_text) ? (
            <section className="report-card-section report-card-notes">
              <p className="report-card-notes-title">Important notes</p>
              <ul>
                {data.footer.next_term_label ? (
                  <li>
                    <strong>Next term:</strong> {data.footer.next_term_label}
                    {data.footer.next_term_starts_on
                      ? ` · starts ${new Date(data.footer.next_term_starts_on).toLocaleDateString()}`
                      : ""}
                    {data.footer.next_term_note ? ` — ${data.footer.next_term_note}` : ""}
                  </li>
                ) : data.footer.next_term_note ? (
                  <li>
                    <strong>Next term:</strong> {data.footer.next_term_note}
                  </li>
                ) : null}
                {data.footer.term_fees_summary ? (
                  <li>
                    <strong>Fees:</strong> {data.footer.term_fees_summary}
                  </li>
                ) : null}
                {data.footer.requirements_text ? (
                  <li>
                    <strong>Requirements:</strong> {data.footer.requirements_text}
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <footer className="report-card-footer">
            <div className="report-card-signatures">
              <SignatureBlock label="Class teacher" />
              <SignatureBlock label="Head teacher" name={data.school.head_teacher_name} />
            </div>
            <div className="report-card-meta">
              <span>
                Generated {new Date(data.generated_at).toLocaleDateString()} · Invalid without
                official stamp and signature
              </span>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="report-card-section-title">{children}</h2>;
}

function SummaryStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "report-card-summary-stat report-card-summary-stat--emphasis" : "report-card-summary-stat"}>
      <span className="report-card-summary-label">{label}</span>
      <span className="report-card-summary-value">{value}</span>
    </div>
  );
}

function CommentBlock({
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
    <div className="report-card-comment">
      <p className="report-card-comment-role">{role}</p>
      <p className="report-card-comment-text">{comment ?? fallback}</p>
    </div>
  );
}

function SignatureBlock({ label, name }: { label: string; name?: string | null }) {
  return (
    <div className="report-card-signature">
      <div className="report-card-signature-line" />
      <p className="report-card-signature-label">
        {label}
        {name ? <span className="report-card-signature-name"> · {name}</span> : null}
      </p>
    </div>
  );
}
