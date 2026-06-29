"use client";

import type { ReportCardPreviewOut } from "@/lib/types";
import type { ReportCardLayoutConfig } from "@/lib/reportCardConfig";
import {
  CommentBlock,
  fmt,
  ReportCardFooterBlock,
  ReportCardHeaderBlock,
  ReportCardIdentityBlock,
  ReportCardShell,
  ReportCardTitleBand,
  SectionTitle,
  SummaryStat,
} from "../reportCardParts";

/** Compact primary layout — subjects and comments without the assessment matrix. */
export function PrimarySimpleTemplate({
  data,
  layout,
}: {
  data: ReportCardPreviewOut;
  layout: ReportCardLayoutConfig;
}) {
  const sections = layout.sections;
  const lines = data.subject_lines ?? [];

  return (
    <ReportCardShell data={data} layout={layout}>
      <ReportCardHeaderBlock data={data} sections={sections} />
      <ReportCardTitleBand title={layout.document_title} />
      <ReportCardIdentityBlock data={data} />

      {!data.marks_available ? (
        <p className="report-card-notice">
          Assessment marks have not been recorded for this term. Scores will appear once marks are
          entered under Assessment.
        </p>
      ) : null}

      {sections.subject_performance ? (
        <section className="report-card-section">
          <SectionTitle>Subject performance</SectionTitle>
          <table className="report-card-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Score %</th>
                <th>Grade</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.subject_id}>
                  <td>{line.subject_name}</td>
                  <td className="report-card-num">{fmt(line.ca_score)}</td>
                  <td className="report-card-num report-card-strong">
                    {line.grade ?? fmt(line.aggregate_points)}
                  </td>
                  <td className="report-card-comment-cell">{line.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {sections.summary_bar && data.marks_available ? (
            <div className="report-card-summary-bar report-card-summary-bar--simple">
              <SummaryStat label="Average" value={fmt(data.average_score, "%")} emphasis />
            </div>
          ) : null}
        </section>
      ) : null}

      {sections.grading_key && data.grading_key.length ? (
        <section className="report-card-section">
          <SectionTitle>Grading key</SectionTitle>
          <ul className="report-card-grading-list report-card-grading-list--inline">
            {data.grading_key.map((g) => (
              <li key={g.label}>
                <span>{g.label}</span>
                <span className="report-card-num">
                  {g.min_mark}–{g.max_mark}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.attendance && data.attendance ? (
        <section className="report-card-section">
          <SectionTitle>Attendance</SectionTitle>
          <p className="report-card-muted">
            {data.attendance.present_days}/{data.attendance.total_days} days present ·{" "}
            {data.attendance.percentage}%
          </p>
        </section>
      ) : null}

      {sections.teacher_comments ? (
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
      ) : null}

      <ReportCardFooterBlock data={data} sections={sections} />
    </ReportCardShell>
  );
}
