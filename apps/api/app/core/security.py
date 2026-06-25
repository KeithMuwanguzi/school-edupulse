"""Password hashing (bcrypt) and JWT access/refresh tokens (§3, §4.8)."""
from __future__ import annotations

import datetime as dt
import hashlib
import secrets
import uuid

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"


# --- Passwords -----------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --- JWT -----------------------------------------------------------------
def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def create_access_token(claims: dict) -> str:
    payload = {
        **claims,
        "token_type": "access",
        "iat": _now(),
        "exp": _now() + dt.timedelta(minutes=settings.jwt_access_expire_minutes),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises jwt.PyJWTError subclasses on invalid/expired tokens."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


# --- Refresh tokens ------------------------------------------------------
def generate_refresh_token() -> str:
    """Opaque high-entropy refresh token (stored only as a hash)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_expiry() -> dt.datetime:
    return _now() + dt.timedelta(days=settings.jwt_refresh_expire_days)


# --- Hashing helpers for logs (§4.6) ------------------------------------
def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()
