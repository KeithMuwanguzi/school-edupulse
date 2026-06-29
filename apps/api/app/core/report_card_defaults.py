"""Default report card layout for schools."""

from __future__ import annotations

from typing import Any

DEFAULT_REPORT_CARD_SECTIONS: dict[str, bool] = {
    "header": True,
    "assessment_matrix": True,
    "subject_performance": True,
    "summary_bar": True,
    "grading_key": True,
    "attendance": True,
    "teacher_comments": True,
    "footer": True,
    "signatures": True,
    "show_aggregate": True,
}

DEFAULT_REPORT_CARD_LAYOUT: dict[str, Any] = {
    "template_id": "uneb_standard_v1",
    "document_title": "Terminal Report",
    "primary_color": "#334155",
    "sections": DEFAULT_REPORT_CARD_SECTIONS,
}


def merge_report_card_layout(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw:
        return dict(DEFAULT_REPORT_CARD_LAYOUT)
    sections = {**DEFAULT_REPORT_CARD_SECTIONS, **(raw.get("sections") or {})}
    return {
        "template_id": raw.get("template_id") or DEFAULT_REPORT_CARD_LAYOUT["template_id"],
        "document_title": (raw.get("document_title") or DEFAULT_REPORT_CARD_LAYOUT["document_title"]).strip(),
        "primary_color": (raw.get("primary_color") or DEFAULT_REPORT_CARD_LAYOUT["primary_color"]).strip(),
        "sections": sections,
    }
