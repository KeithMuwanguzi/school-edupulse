"""School badge upload and branding."""
from __future__ import annotations

from uuid import UUID

import pytest

from app.services import school_badge_service
from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio

# 1x1 PNG
_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


async def test_upload_and_fetch_badge(client, admin_headers):
    headers, body = await onboard_and_login(client, admin_headers, "BDG01")
    tenant_id = body["tenant_id"]

    upload = await client.post(
        f"/api/v1/platform/schools/{tenant_id}/badge",
        headers=admin_headers,
        files={"file": ("badge.png", _PNG_BYTES, "image/png")},
    )
    assert upload.status_code == 200, upload.text
    badge_url = upload.json()["profile"]["badge_url"]
    assert badge_url is not None
    assert tenant_id in badge_url

    school = await client.get(f"/api/v1/platform/schools/{tenant_id}", headers=admin_headers)
    assert school.json()["profile"]["badge_url"] == badge_url

    public = await client.get(f"/api/v1/branding/{tenant_id}/badge")
    assert public.status_code == 200
    assert public.headers["content-type"].startswith("image/")


async def test_tenant_admin_can_upload_badge(client, admin_headers):
    headers, body = await onboard_and_login(client, admin_headers, "BDG02")
    tenant_id = body["tenant_id"]

    upload = await client.post(
        "/api/v1/tenant/school/badge",
        headers=headers,
        files={"file": ("crest.png", _PNG_BYTES, "image/png")},
    )
    assert upload.status_code == 200, upload.text
    assert upload.json()["profile"]["badge_url"] is not None

    removed = await client.delete("/api/v1/tenant/school/badge", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["profile"]["badge_url"] is None

    missing = await client.get(f"/api/v1/branding/{tenant_id}/badge")
    assert missing.status_code == 404


async def test_stale_badge_url_hidden_when_file_missing(client, admin_headers):
    headers, body = await onboard_and_login(client, admin_headers, "BDG03")
    tenant_id = body["tenant_id"]

    upload = await client.post(
        "/api/v1/tenant/school/badge",
        headers=headers,
        files={"file": ("badge.png", _PNG_BYTES, "image/png")},
    )
    assert upload.status_code == 200, upload.text

    # Simulate container rebuild: DB still has badge_url but file is gone.
    badge_path = school_badge_service.badge_file_path(UUID(tenant_id))
    assert badge_path is not None
    badge_path.unlink()

    school = await client.get("/api/v1/tenant/school", headers=headers)
    assert school.status_code == 200, school.text
    assert school.json()["profile"]["badge_url"] is None
