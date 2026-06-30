"""Prometheus-compatible metrics endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.core.config import settings
from app.core.errors import ForbiddenError
from app.core.metrics import render_prometheus

router = APIRouter(tags=["metrics"])


def _require_metrics_access(request: Request) -> None:
    if not settings.metrics_token:
        return
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {settings.metrics_token}":
        raise ForbiddenError("Metrics access denied.")


@router.get("/metrics")
async def metrics(
    _: None = Depends(_require_metrics_access),
) -> Response:
    """Expose in-process metrics for Prometheus scraping."""
    return Response(content=render_prometheus(), media_type="text/plain; version=0.0.4")
