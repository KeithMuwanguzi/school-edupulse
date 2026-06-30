"""Password strength validation."""
from __future__ import annotations

import re

from app.core.errors import ValidationError

_MIN_LENGTH = 8
_MAX_LENGTH = 128


def validate_password_strength(password: str) -> None:
    """Require mixed case, digit, and minimum length."""
    if len(password) < _MIN_LENGTH:
        raise ValidationError(f"Password must be at least {_MIN_LENGTH} characters.")
    if len(password) > _MAX_LENGTH:
        raise ValidationError(f"Password must be at most {_MAX_LENGTH} characters.")
    if not re.search(r"[a-z]", password):
        raise ValidationError("Password must include a lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValidationError("Password must include an uppercase letter.")
    if not re.search(r"\d", password):
        raise ValidationError("Password must include a digit.")
