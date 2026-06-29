"use client";

import type { ReactNode } from "react";
import { SchoolBadge } from "@/components/domain/school/SchoolBadge";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import type {
  ReportCardAssessmentSet,
  ReportCardPreviewOut,
  ReportCardSubjectLine,
} from "@/lib/types";
import type { ReportCardLayoutConfig, ReportCardSectionsConfig } from "@/lib/reportCardConfig";

export function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null) return "—";
  return `${value}${suffix}`;
}

export function setScore(line: ReportCardSubjectLine, setId: string): number | null {
  const found = line.set_scores.find((s) => s.set_id === setId);
  return found?.score ?? null;
}

export function rowTotals(sets: ReportCardAssessmentSet[], lines: ReportCardSubjectLine[]) {
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

export function ReportCardShell({
  data,
  layout,
  children,
}: {
  data: ReportCardPreviewOut;
  layout: ReportCardLayoutConfig;
  children: ReactNode;
}) {
  return (
    <article className="report-card-print">
      <div className="report-card-frame" aria-hidden />
      <div className="report-card-body">{children}</div>
    </article>
  );
}

export function ReportCardHeaderBlock({
  data,
  sections,
}: {
  data: ReportCardPreviewOut;
  sections: ReportCardSectionsConfig;
}) {
  if (!sections.header) return null;

  const contactBits = [
    data.school.address_line,
    data.school.phone ? `Tel: ${data.school.phone}` : null,
    data.school.email ? `Email: ${data.school.email}` : null,
  ].filter(Boolean);

  return (
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
  );
}

export function ReportCardTitleBand({ title }: { title: string }) {
  return (
    <div className="report-card-title-band">
      <span>{title}</span>
    </div>
  );
}

export function ReportCardIdentityBlock({ data }: { data: ReportCardPreviewOut }) {
  const studentName = formatStudentFullName({
    last_name: data.student.last_name,
    middle_name: data.student.middle_name,
    first_name: data.student.first_name,
  });
  const classLine = [data.student.class_label, data.student.stream_name].filter(Boolean).join(" · ");

  return (
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
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="report-card-section-title">{children}</h2>;
}

export function SummaryStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis ? "report-card-summary-stat report-card-summary-stat--emphasis" : "report-card-summary-stat"
      }
    >
      <span className="report-card-summary-label">{label}</span>
      <span className="report-card-summary-value">{value}</span>
    </div>
  );
}

export function GradingKeyAside({ data, sections }: { data: ReportCardPreviewOut; sections: ReportCardSectionsConfig }) {
  if (!sections.grading_key && !sections.attendance) return null;

  return (
    <aside className="report-card-sidebar">
      {sections.grading_key ? (
        <>
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
        </>
      ) : null}
      {sections.attendance && data.attendance ? (
        <div className="report-card-attendance">
          <p className="report-card-sidebar-subtitle">Attendance</p>
          <p className="report-card-muted">
            {data.attendance.present_days}/{data.attendance.total_days} days · {data.attendance.percentage}%
          </p>
        </div>
      ) : null}
    </aside>
  );
}

export function CommentBlock({
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

export function SignatureBlock({ label, name }: { label: string; name?: string | null }) {
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

export function ReportCardFooterBlock({
  data,
  sections,
}: {
  data: ReportCardPreviewOut;
  sections: ReportCardSectionsConfig;
}) {
  const hasNotes =
    data.footer &&
    (data.footer.next_term_label ||
      data.footer.next_term_note ||
      data.footer.term_fees_summary ||
      data.footer.requirements_text);

  return (
    <>
      {sections.footer && hasNotes ? (
        <section className="report-card-section report-card-notes">
          <p className="report-card-notes-title">Important notes</p>
          <ul>
            {data.footer!.next_term_label ? (
              <li>
                <strong>Next term:</strong> {data.footer!.next_term_label}
                {data.footer!.next_term_starts_on
                  ? ` · starts ${new Date(data.footer!.next_term_starts_on).toLocaleDateString()}`
                  : ""}
                {data.footer!.next_term_note ? ` — ${data.footer!.next_term_note}` : ""}
              </li>
            ) : data.footer!.next_term_note ? (
              <li>
                <strong>Next term:</strong> {data.footer!.next_term_note}
              </li>
            ) : null}
            {data.footer!.term_fees_summary ? (
              <li>
                <strong>Fees:</strong> {data.footer!.term_fees_summary}
              </li>
            ) : null}
            {data.footer!.requirements_text ? (
              <li>
                <strong>Requirements:</strong> {data.footer!.requirements_text}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {sections.signatures ? (
        <footer className="report-card-footer">
          <div className="report-card-signatures">
            <SignatureBlock label="Class teacher" />
            <SignatureBlock label="Head teacher" name={data.school.head_teacher_name} />
          </div>
          <div className="report-card-meta">
            <span>
              Generated {new Date(data.generated_at).toLocaleDateString()} · Invalid without official stamp
              and signature
            </span>
          </div>
        </footer>
      ) : null}
    </>
  );
}
