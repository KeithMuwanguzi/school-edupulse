"""Structured JSONL audit files (Serilog-style file sink) for platform portal download."""
from __future__ import annotations

import datetime as dt
import json
import threading
from pathlib import Path
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("skulpulse.platform_audit_files")
_lock = threading.Lock()


def _base_dir() -> Path:
    root = Path(settings.platform_audit_log_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "global").mkdir(parents=True, exist_ok=True)
    (root / "admins").mkdir(parents=True, exist_ok=True)
    return root


def _month_key(when: dt.datetime | None = None) -> str:
    when = when or dt.datetime.now(dt.UTC)
    return when.strftime("%Y-%m")


def append_audit_event(
    *,
    actor_type: str,
    action: str,
    actor_id: UUID | None = None,
    tenant_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    request_id: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    created_at: dt.datetime | None = None,
) -> None:
    """Append one audit row to monthly global log and per-admin log when applicable."""
    if not settings.platform_audit_file_enabled:
        return

    created_at = created_at or dt.datetime.now(dt.UTC)
    payload = {
        "@t": created_at.isoformat().replace("+00:00", "Z"),
        "actor_type": actor_type,
        "actor_id": str(actor_id) if actor_id else None,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "action": action,
        "resource_type": resource_type,
        "resource_id": str(resource_id) if resource_id else None,
        "request_id": request_id,
        "metadata": metadata or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
    }
    line = json.dumps(payload, separators=(",", ":"), default=str) + "\n"
    month = _month_key(created_at)

    try:
        with _lock:
            base = _base_dir()
            global_path = base / "global" / f"audit-{month}.jsonl"
            with global_path.open("a", encoding="utf-8") as fh:
                fh.write(line)

            if actor_type == "platform_admin" and actor_id is not None:
                admin_path = base / "admins" / f"{actor_id}.jsonl"
                with admin_path.open("a", encoding="utf-8") as fh:
                    fh.write(line)
    except Exception:
        log.exception("platform_audit_file.write_failed", action=action)


def list_log_files() -> list[dict]:
    """Inventory of downloadable audit JSONL files."""
    base = _base_dir()
    items: list[dict] = []

    global_dir = base / "global"
    if global_dir.is_dir():
        for path in sorted(global_dir.glob("audit-*.jsonl"), reverse=True):
            stat = path.stat()
            items.append(
                {
                    "kind": "global",
                    "filename": path.name,
                    "relative_path": f"global/{path.name}",
                    "size_bytes": stat.st_size,
                    "modified_at": dt.datetime.fromtimestamp(
                        stat.st_mtime, tz=dt.UTC
                    ).isoformat(),
                }
            )

    admins_dir = base / "admins"
    if admins_dir.is_dir():
        for path in sorted(admins_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = path.stat()
            items.append(
                {
                    "kind": "admin",
                    "filename": path.name,
                    "relative_path": f"admins/{path.name}",
                    "admin_id": path.stem,
                    "size_bytes": stat.st_size,
                    "modified_at": dt.datetime.fromtimestamp(
                        stat.st_mtime, tz=dt.UTC
                    ).isoformat(),
                }
            )

    return items


def resolve_log_path(relative_path: str) -> Path:
    """Safe path resolution — rejects traversal outside the audit directory."""
    base = _base_dir().resolve()
    rel = relative_path.replace("\\", "/").lstrip("/")
    if ".." in rel.split("/"):
        raise ValueError("Invalid path.")
    if not (rel.startswith("global/") or rel.startswith("admins/")):
        raise ValueError("Invalid path.")
    if not rel.endswith(".jsonl"):
        raise ValueError("Invalid path.")

    target = (base / rel).resolve()
    if base not in target.parents and target != base:
        raise ValueError("Invalid path.")
    if not target.is_file():
        raise FileNotFoundError(relative_path)
    return target
