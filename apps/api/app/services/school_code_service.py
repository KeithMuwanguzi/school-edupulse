"""Derive unique tenant school codes from school names."""
from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform import Tenant
from app.schemas.school import SCHOOL_CODE_PATTERN

# Common Ugandan school-name words — kept for initials but skipped as the anchor word.
_STOPWORDS = frozenset(
    {
        "primary",
        "secondary",
        "school",
        "college",
        "high",
        "nursery",
        "kindergarten",
        "academy",
        "junior",
        "senior",
        "mixed",
        "day",
        "boarding",
        "modern",
        "international",
        "education",
        "centre",
        "center",
        "pre",
        "prep",
        "ss",
        "ps",
        "the",
        "of",
        "and",
        "for",
        "a",
        "an",
    }
)

_MIN_LEN = 4
_MAX_LEN = 8
_CODE_RE = re.compile(SCHOOL_CODE_PATTERN)


def _normalize_token(raw: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", raw.upper())


def tokenize_school_name(name: str) -> list[str]:
    """Split a display name into uppercase alphanumeric tokens."""
    parts = re.split(r"[^A-Za-z0-9]+", (name or "").strip())
    return [_normalize_token(p) for p in parts if _normalize_token(p)]


def _significant_tokens(tokens: list[str]) -> list[str]:
    sig = [t for t in tokens if t.lower() not in _STOPWORDS]
    return sig if sig else tokens[:1]


def _initials(tokens: list[str]) -> str:
    return "".join(t[0] for t in tokens if t)


def _pad_initials(initials: str, source: str, *, min_len: int = _MIN_LEN) -> str:
    """Extend short initials using letters from `source` (usually the anchor word)."""
    result = initials.upper()
    src = _normalize_token(source)
    if not src:
        src = "SCHOOL"
    idx = 1
    while len(result) < min_len and idx < len(src):
        result += src[idx]
        idx += 1
    while len(result) < min_len:
        result += src[len(result) % len(src)]
    return result[:_MAX_LEN]


def _valid(code: str) -> bool:
    return bool(_CODE_RE.match(code))


def _dedupe(candidates: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in candidates:
        code = _normalize_token(raw)[:_MAX_LEN]
        if not code or not _valid(code) or code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out


def generate_school_code_candidates(name: str) -> list[str]:
    """Return preferred school-code candidates for a name (may include taken codes)."""
    tokens = tokenize_school_name(name)
    if not tokens:
        return ["SCHL"]

    sig = _significant_tokens(tokens)
    anchor = sig[0]
    all_initials = _initials(tokens)
    sig_initials = _initials(sig)

    candidates: list[str] = []

    # Prefer the full anchor when it already fits (SMACK, GAYAZA truncated to 8).
    if _valid(anchor):
        candidates.append(anchor[:_MAX_LEN])

    # Anchor-word prefixes (GAYAZA → GAYA, GAYAZ, …).
    for length in range(_MIN_LEN, min(_MAX_LEN, len(anchor)) + 1):
        candidates.append(anchor[:length])

    # Anchor prefix + initials of remaining words (GAYAZA + PS → GAYPS).
    if len(tokens) > 1:
        tail = _initials(tokens[1:])
        if tail:
            for prefix_len in range(2, min(5, len(anchor) + 1)):
                candidates.append((anchor[:prefix_len] + tail)[:_MAX_LEN])

    # All-word initials padded to minimum length (GPS → GAPS).
    if all_initials:
        candidates.append(_pad_initials(all_initials, anchor))

    # Significant-word initials padded (e.g. PETER + ST → PETE).
    if sig_initials and sig_initials != all_initials:
        candidates.append(_pad_initials(sig_initials, anchor))

    # Last resort: pad anchor if somehow too short.
    if len(anchor) < _MIN_LEN:
        candidates.append(_pad_initials(anchor, anchor))

    return _dedupe(candidates) or ["SCHL"]


def resolve_available_code(name: str, taken: set[str]) -> tuple[str, bool, str | None]:
    """Pick the first free candidate; append a numeric suffix when all collide."""
    candidates = generate_school_code_candidates(name)
    for code in candidates:
        if code not in taken:
            return code, False, None

    base = candidates[0]
    for n in range(2, 100):
        suffix = str(n)
        trimmed = base[: _MAX_LEN - len(suffix)]
        code = f"{trimmed}{suffix}"
        if _valid(code) and code not in taken:
            return code, True, f"{base} is already assigned — appended {suffix}."

    # Extremely unlikely: fall back to random-ish suffix from name hash.
    anchor = _significant_tokens(tokenize_school_name(name))[0][:4]
    for n in range(2, 1000):
        code = f"{anchor[: max(1, _MAX_LEN - len(str(n)))]}{n}"[:_MAX_LEN]
        if _valid(code) and code not in taken:
            return code, True, "Assigned a numeric suffix after many collisions."

    return "SCHL", True, "Fallback code used."


async def load_taken_codes(session: AsyncSession) -> set[str]:
    rows = await session.scalars(select(Tenant.school_code))
    return set(rows.all())


async def suggest_school_code(
    session: AsyncSession,
    name: str,
) -> tuple[str, bool, str | None]:
    taken = await load_taken_codes(session)
    return resolve_available_code(name.strip(), taken)
