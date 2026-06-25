"""Request/error logging on every API call (§4.6, §11)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.logs import ApiRequestLog, ErrorLog

pytestmark = pytest.mark.asyncio


async def test_health_ok_and_returns_request_id(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id")


async def test_request_id_is_propagated(client):
    rid = "11111111-2222-3333-4444-555555555555"
    resp = await client.get("/api/v1/health", headers={"X-Request-ID": rid})
    assert resp.headers["x-request-id"] == rid


async def test_every_request_writes_request_log(client, db):
    resp = await client.get("/api/v1/health")
    rid = resp.headers["x-request-id"]

    row = await db.scalar(select(ApiRequestLog).where(ApiRequestLog.request_id == rid))
    assert row is not None
    assert row.path == "/api/v1/health"
    assert row.status_code == 200
    assert row.method == "GET"
    assert row.actor_type == "anonymous"


async def test_404_writes_request_log(client, db):
    resp = await client.get("/api/v1/does-not-exist")
    rid = resp.headers["x-request-id"]
    row = await db.scalar(select(ApiRequestLog).where(ApiRequestLog.request_id == rid))
    assert row is not None
    assert row.status_code == 404


async def test_forced_500_writes_error_log_and_request_id(client, db):
    resp = await client.get("/api/v1/_debug/boom")
    assert resp.status_code == 500
    rid = resp.headers["x-request-id"]

    # Response body carries request_id (RFC 7807).
    body = resp.json()
    assert body["request_id"] == rid
    assert body["code"] == "INTERNAL_ERROR"
    # No stack trace leaked to the client.
    assert "stack_trace" not in body

    # api_request_logs row exists with 500.
    req_row = await db.scalar(select(ApiRequestLog).where(ApiRequestLog.request_id == rid))
    assert req_row is not None and req_row.status_code == 500
    assert req_row.error_code == "INTERNAL_ERROR"

    # error_logs row exists, linked by request_id, with a server-side stack trace.
    err_row = await db.scalar(select(ErrorLog).where(ErrorLog.request_id == rid))
    assert err_row is not None
    assert err_row.error_type == "RuntimeError"
    assert err_row.stack_trace and "RuntimeError" in err_row.stack_trace
