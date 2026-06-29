"use client";

import type { ReportCardPreviewOut } from "@/lib/types";
import type { ReportCardLayoutConfig } from "@/lib/reportCardConfig";
import {
  CommentBlock,
  fmt,
  GradingKeyAside,
  ReportCardFooterBlock,
  ReportCardHeaderBlock,
  ReportCardIdentityBlock,
  ReportCardShell,
  ReportCardTitleBand,
  rowTotals,
  SectionTitle,
  setScore,
  SummaryStat,
} from "../reportCardParts";

export function UnebStandardTemplate({
  data,
  layout,
}: {
  data: ReportCardPreviewOut;
  layout: ReportCardLayoutConfig;
}) {
  const sections = layout.sections;
  const isPle = data.assessment_mode === "ple";
  const sets = data.assessment_sets ?? [];
  const lines = data.subject_lines ?? [];
  const hasSetMatrix =
    sections.assessment_matrix && sets.length > 0 && data.marks_available;
  const totals = rowTotals(sets, lines);

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

      {sections.subject_performance ? (
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
                      {line.is_core ? <span className="report-card-core-tag">core</span> : null}
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
                      {sections.show_aggregate
                        ? fmt(data.total_aggregate ?? data.aggregate)
                        : "—"}
                    </td>
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>

            {sections.summary_bar && data.marks_available ? (
              <div className="report-card-summary-bar">
                <SummaryStat label="Average" value={fmt(data.average_score, "%")} />
                {sections.show_aggregate ? (
                  <>
                    <SummaryStat
                      label="Aggregate"
                      value={fmt(data.total_aggregate ?? data.aggregate)}
                    />
                    <SummaryStat label="Division" value={data.division_label ?? "—"} emphasis />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <GradingKeyAside data={data} sections={sections} />
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
