"""Server-side report card PDF generation."""

from __future__ import annotations

import html
import io
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from xhtml2pdf import pisa

from app.services import reportcard_service


def _esc(value: object | None) -> str:
    if value is None:
        return ""
    return html.escape(str(value))


def _build_html(preview) -> str:
    layout = preview.layout
    primary = layout.primary_color
    student_name = " ".join(
        p
        for p in (
            preview.student.last_name,
            preview.student.middle_name,
            preview.student.first_name,
        )
        if p
    )
    class_line = " · ".join(
        p for p in (preview.student.class_label, preview.student.stream_name) if p
    )

    subject_rows = ""
    for line in preview.subject_lines:
        subject_rows += f"""
        <tr>
          <td>{_esc(line.subject_name)}</td>
          <td align="center">{_esc(line.ca_score)}</td>
          <td align="center">{_esc(line.grade or line.aggregate_points)}</td>
          <td>{_esc(line.comment or "—")}</td>
        </tr>
        """

    grading_rows = ""
    for band in preview.grading_key:
        grading_rows += f"""
        <tr>
          <td>{_esc(band.label)}</td>
          <td align="center">{band.min_mark}–{band.max_mark}</td>
        </tr>
        """

    attendance = ""
    if preview.attendance:
        attendance = f"""
        <p><strong>Attendance:</strong>
        {preview.attendance.present_days}/{preview.attendance.total_days} days
        ({preview.attendance.percentage}%)</p>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page {{ size: A4 portrait; margin: 12mm; }}
    body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #1e293b; }}
    h1 {{ color: {primary}; font-size: 16pt; text-align: center; margin: 0 0 4mm; }}
    h2 {{ color: {primary}; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }}
    .title-band {{
      text-align: center; margin: 4mm 0;
      border: 1px solid {primary}; border-radius: 999px;
      padding: 2mm 6mm; display: inline-block; width: auto;
      font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; font-size: 9pt;
    }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 2mm; }}
    th {{ background: {primary}; color: #fff; padding: 2mm; font-size: 8pt; }}
    td {{ border: 1px solid #cbd5e1; padding: 1.5mm 2mm; font-size: 9pt; }}
    .meta {{ margin: 3mm 0; padding: 2mm; background: #f8fafc; border: 1px solid #e2e8f0; }}
    .comments {{ margin-top: 4mm; }}
    .comment {{ border: 1px solid #e2e8f0; padding: 2mm; margin-bottom: 2mm; }}
  </style>
</head>
<body>
  <h1>{_esc(preview.school.name)}</h1>
  <p style="text-align:center">{_esc(preview.school.motto)}</p>
  <p style="text-align:center"><span class="title-band">{_esc(layout.document_title)}</span></p>

  <div class="meta">
    <p><strong>Name:</strong> {_esc(student_name)}</p>
    <p><strong>Pupil No.:</strong> {_esc(preview.student.student_number)} ·
       <strong>Class:</strong> {_esc(class_line)} ·
       <strong>Term:</strong> {_esc(preview.term.label)} ·
       <strong>Year:</strong> {_esc(preview.term.academic_year_label)}</p>
  </div>

  <h2>End of term performance</h2>
  <table>
    <thead><tr><th>Subject</th><th>Score %</th><th>Grade</th><th>Comment</th></tr></thead>
    <tbody>{subject_rows}</tbody>
  </table>

  {attendance}

  <h2>Grading key</h2>
  <table>
    <thead><tr><th>Grade</th><th>Mark range</th></tr></thead>
    <tbody>{grading_rows}</tbody>
  </table>

  <div class="comments">
    <div class="comment">
      <strong>Class teacher</strong><br/>
      {_esc(preview.class_teacher_comment or "—")}
    </div>
    <div class="comment">
      <strong>Head teacher</strong><br/>
      {_esc(preview.head_teacher_comment or "—")}
    </div>
  </div>
</body>
</html>
"""


async def render_pdf(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    term_id: UUID | None = None,
) -> bytes:
    preview = await reportcard_service.get_preview(
        session,
        tenant_id,
        student_id=student_id,
        term_id=term_id,
    )
    html_doc = _build_html(preview)
    buffer = io.BytesIO()
    status = pisa.CreatePDF(html_doc, dest=buffer, encoding="utf-8")
    if status.err:
        raise RuntimeError("PDF generation failed")
    return buffer.getvalue()
