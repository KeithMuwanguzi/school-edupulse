"""Security headers + request body size limit (§4.8)."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_security_headers_present(client):
    resp = await client.get("/api/v1/health")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "no-referrer"
    assert "default-src 'none'" in resp.headers.get("content-security-policy", "")


async def test_swagger_docs_csp_allows_cdn(client):
    resp = await client.get("/api/v1/docs")
    assert resp.status_code == 200
    csp = resp.headers.get("content-security-policy", "")
    assert "cdn.jsdelivr.net" in csp
    assert "default-src 'none'" not in csp


async def test_oversized_body_rejected(client):
    big = {"email": "a@b.co", "password": "x" * 1_100_000}
    resp = await client.post("/api/v1/auth/platform/login", json=big)
    assert resp.status_code == 413
    assert resp.json()["code"] == "PAYLOAD_TOO_LARGE"
