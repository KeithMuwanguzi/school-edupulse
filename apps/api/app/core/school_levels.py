"""Central registry for nursery (ECD) and primary class levels — Uganda NCDC."""
from __future__ import annotations

from app.models.enums import ClassLevel, NcdcCycle

NURSERY_LEVELS: tuple[ClassLevel, ...] = (
    ClassLevel.BABY,
    ClassLevel.MIDDLE,
    ClassLevel.TOP,
)

PRIMARY_LEVELS: tuple[ClassLevel, ...] = (
    ClassLevel.P1,
    ClassLevel.P2,
    ClassLevel.P3,
    ClassLevel.P4,
    ClassLevel.P5,
    ClassLevel.P6,
    ClassLevel.P7,
)

ALL_LEVELS: tuple[ClassLevel, ...] = NURSERY_LEVELS + PRIMARY_LEVELS

LEVEL_LABELS: dict[ClassLevel, str] = {
    ClassLevel.BABY: "Baby Class",
    ClassLevel.MIDDLE: "Middle Class",
    ClassLevel.TOP: "Top Class",
    ClassLevel.P1: "Primary One",
    ClassLevel.P2: "Primary Two",
    ClassLevel.P3: "Primary Three",
    ClassLevel.P4: "Primary Four",
    ClassLevel.P5: "Primary Five",
    ClassLevel.P6: "Primary Six",
    ClassLevel.P7: "Primary Seven",
}

LEVEL_ORDER: dict[ClassLevel, int] = {
    ClassLevel.BABY: 1,
    ClassLevel.MIDDLE: 2,
    ClassLevel.TOP: 3,
    ClassLevel.P1: 4,
    ClassLevel.P2: 5,
    ClassLevel.P3: 6,
    ClassLevel.P4: 7,
    ClassLevel.P5: 8,
    ClassLevel.P6: 9,
    ClassLevel.P7: 10,
}

LEVEL_CYCLE: dict[ClassLevel, NcdcCycle] = {
    ClassLevel.BABY: NcdcCycle.ecd,
    ClassLevel.MIDDLE: NcdcCycle.ecd,
    ClassLevel.TOP: NcdcCycle.ecd,
    ClassLevel.P1: NcdcCycle.cycle_1,
    ClassLevel.P2: NcdcCycle.cycle_1,
    ClassLevel.P3: NcdcCycle.cycle_1,
    ClassLevel.P4: NcdcCycle.cycle_2,
    ClassLevel.P5: NcdcCycle.cycle_3,
    ClassLevel.P6: NcdcCycle.cycle_3,
    ClassLevel.P7: NcdcCycle.cycle_3,
}

LOWER_PRIMARY_LEVELS = frozenset({ClassLevel.P1, ClassLevel.P2, ClassLevel.P3})

CLASS_LEVEL_VALUES: frozenset[str] = frozenset(level.value for level in ALL_LEVELS)


def is_nursery(level: ClassLevel) -> bool:
    return level in NURSERY_LEVELS


def is_primary(level: ClassLevel) -> bool:
    return level in PRIMARY_LEVELS


def level_section(level: ClassLevel) -> str:
    if level in NURSERY_LEVELS:
        return "Nursery"
    if level in LOWER_PRIMARY_LEVELS:
        return "Lower Primary"
    if level == ClassLevel.P7:
        return "Upper Primary"
    return "Upper Primary"


def assessment_mode(level: ClassLevel) -> str:
    """Layout hint for report cards and mark entry."""
    if level in NURSERY_LEVELS:
        return "ecd_competence"
    if level == ClassLevel.P7:
        return "ple"
    return "subject_ca"


def parse_class_level(value: str) -> ClassLevel:
    normalized = value.strip().upper()
    for level in ALL_LEVELS:
        if level.value == normalized:
            return level
    raise ValueError(f"Unknown class level: {value}")
