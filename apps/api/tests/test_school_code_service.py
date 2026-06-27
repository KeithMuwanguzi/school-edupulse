"""School code generation from names."""
from __future__ import annotations

from app.services.school_code_service import (
    generate_school_code_candidates,
    resolve_available_code,
    tokenize_school_name,
)


def test_tokenize_strips_punctuation():
    assert tokenize_school_name("St. Peter's Primary School") == [
        "ST",
        "PETER",
        "S",
        "PRIMARY",
        "SCHOOL",
    ]


def test_gayaza_primary_school_candidates():
    codes = generate_school_code_candidates("Gayaza Primary School")
    assert "GAYA" in codes
    assert "GAYPS" in codes
    assert all(len(c) >= 4 for c in codes)


def test_galama_primary_school_differs_from_gayaza():
    gayaza = generate_school_code_candidates("Gayaza Primary School")
    galama = generate_school_code_candidates("Galama Primary School")
    assert gayaza[0].startswith("GAY")
    assert galama[0].startswith("GAL")
    assert gayaza[0] != galama[0]


def test_resolve_collision_appends_suffix():
    gayaza = generate_school_code_candidates("Gayaza Primary School")
    galama = generate_school_code_candidates("Galama Primary School")
    assert gayaza[0].startswith("GAY")
    assert galama[0].startswith("GAL")
    assert gayaza[0] != galama[0]

    code, adjusted, _ = resolve_available_code("Galama Primary School", {gayaza[0]})
    assert code not in {gayaza[0]}
    assert code.startswith("GAL")
    assert adjusted is False

    code, adjusted, note = resolve_available_code("Galama Primary School", set(galama))
    assert adjusted is True
    assert code not in set(galama)
    assert note


def test_short_name_still_valid():
    codes = generate_school_code_candidates("SMACK")
    assert codes[0] == "SMACK"

    code, _, _ = resolve_available_code("SMACK", set())
    assert code == "SMACK"
