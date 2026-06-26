#!/usr/bin/env python3
"""Generate bulk sample CSV files for client onboarding simulation.

Output: docs/sample-data/students-import.csv, staff-import.csv
"""
from __future__ import annotations

import csv
import itertools
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "sample-data"

SURNAMES = [
    "Okello", "Namuli", "Mukasa", "Ssemwanga", "Nabukeera", "Akello", "Opio", "Auma",
    "Nakato", "Kiggundu", "Mbabazi", "Tumwine", "Kawesa", "Nalubega", "Wasswa", "Nansubuga",
    "Kato", "Byaruhanga", "Asiimwe", "Mugisha", "Ahabwe", "Kansiime", "Nabirye", "Otim",
    "Lukwago", "Nabwire", "Ssebunya", "Kizito", "Nabukenya", "Muwanga",
]

GIVEN_MALE = [
    "James", "Peter", "Brian", "Joseph", "David", "Samuel", "Emmanuel", "Patrick", "Moses",
    "Isaac", "Daniel", "Geoffrey", "Ronald", "Francis", "Stephen", "Andrew", "Paul", "John",
    "Michael", "Robert", "Henry", "Richard", "Simon", "Benjamin", "Mark", "Luke", "Timothy",
    "Joshua", "Aaron", "Noah",
]

GIVEN_FEMALE = [
    "Amina", "Faith", "Ruth", "Grace", "Sarah", "Mary", "Joy", "Hope", "Mercy", "Patience",
    "Rebecca", "Esther", "Naomi", "Rachel", "Deborah", "Priscilla", "Lydia", "Martha",
    "Elizabeth", "Catherine", "Florence", "Irene", "Janet", "Susan", "Angela", "Dorothy",
    "Helen", "Alice", "Betty", "Caroline",
]

MIDDLE = ["", "James", "Mary", "John", "Peter", "Grace", "Paul", "Joseph", "David", "Sarah"]

DISTRICTS = ["Kampala", "Wakiso", "Mukono", "Jinja", "Mbale", "Gulu", "Mbarara", "Lira"]
VILLAGES = ["Kireka", "Bweyogerere", "Ntinda", "Muyenga", "Kyanja", "Najera", "Bukoto", "Nateete"]
RELIGIONS = ["Catholic", "Anglican", "Muslim", "Seventh Day Adventist", "Pentecostal"]
BLOOD = ["O+", "A+", "B+", "AB+", "O-", "A-", "B+"]
RELATIONSHIPS = ["mother", "father", "guardian", "aunt", "uncle"]

# Approximate birth year for active year 2026
CLASS_BIRTH_YEAR = {
    "BABY": 2023,
    "MIDDLE": 2022,
    "TOP": 2021,
    "P1": 2020,
    "P2": 2019,
    "P3": 2018,
    "P4": 2017,
    "P5": 2016,
    "P6": 2015,
    "P7": 2014,
}

PRIMARY_LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]
NURSERY_LEVELS = ["BABY", "MIDDLE", "TOP"]

STUDENT_HEADER = [
    "surname", "middle_name", "given_name", "lin", "class_level", "stream",
    "gender", "date_of_birth", "nationality", "religion", "residence", "admission_date",
    "previous_school", "home_address", "village", "district",
    "guardian_name", "guardian_relationship", "guardian_phone", "guardian_email",
    "blood_group", "allergies", "medical_conditions",
]

STAFF_HEADER = ["login_id", "name", "email", "role_key"]

TEACHER_NAMES = [
    ("Grace Namuli", "grace.namuli"),
    ("John Okello", "john.okello"),
    ("Sarah Akello", "sarah.akello"),
    ("Peter Mukasa", "peter.mukasa"),
    ("Mary Ssemwanga", "mary.ssemwanga"),
    ("David Opio", "david.opio"),
    ("Ruth Nakato", "ruth.nakato"),
    ("Joseph Kiggundu", "joseph.kiggundu"),
    ("Faith Mbabazi", "faith.mbabazi"),
    ("Emmanuel Tumwine", "emmanuel.tumwine"),
    ("Patience Kawesa", "patience.kawesa"),
    ("Samuel Nalubega", "samuel.nalubega"),
    ("Mercy Wasswa", "mercy.wasswa"),
    ("Geoffrey Kato", "geoffrey.kato"),
    ("Esther Byaruhanga", "esther.byaruhanga"),
]


def _cycle(names: list[str]) -> itertools.cycle:
    return itertools.cycle(names)


def _phone(n: int) -> str:
    return f"+256700{n:06d}"


def _dob(class_level: str, index: int) -> str:
    year = CLASS_BIRTH_YEAR[class_level]
    month = (index % 12) + 1
    day = (index % 27) + 1
    return f"{year}-{month:02d}-{day:02d}"


def student_row(
    class_level: str,
    index: int,
    *,
    per_class: int,
    use_streams: bool,
) -> dict[str, str]:
    gender = "male" if index % 2 == 0 else "female"
    given_pool = GIVEN_MALE if gender == "male" else GIVEN_FEMALE
    surname = SURNAMES[index % len(SURNAMES)]
    given = given_pool[index % len(given_pool)]
    middle = MIDDLE[index % len(MIDDLE)]
    district = DISTRICTS[index % len(DISTRICTS)]
    village = VILLAGES[index % len(VILLAGES)]
    stream = ""
    if use_streams and class_level in PRIMARY_LEVELS:
        stream = "A" if index % 2 == 0 else "B"
    residence = "boarder" if class_level in ("P5", "P6", "P7") and index % 5 == 0 else "day"
    guardian_given = GIVEN_FEMALE[index % len(GIVEN_FEMALE)]
    guardian_surname = SURNAMES[(index + 3) % len(SURNAMES)]
    phone = _phone(100000 + index + hash(class_level) % 899999)
    email = f"guardian.{class_level.lower()}.{index}@example.com" if index % 4 == 0 else ""
    allergies = "Peanuts" if index % 17 == 0 else ""
    conditions = "Asthma" if index % 23 == 0 else ""
    lin = f"UG-LIN-{class_level}-{index:04d}" if index % 10 == 0 else ""

    return {
        "surname": surname,
        "middle_name": middle,
        "given_name": given,
        "lin": lin,
        "class_level": class_level,
        "stream": stream,
        "gender": gender,
        "date_of_birth": _dob(class_level, index),
        "nationality": "Ugandan",
        "religion": RELIGIONS[index % len(RELIGIONS)],
        "residence": residence,
        "admission_date": "2026-01-15",
        "previous_school": "Little Stars NS" if class_level in NURSERY_LEVELS else "",
        "home_address": f"Plot {index + 1} {village} Rd" if index % 3 != 0 else "",
        "village": village if index % 3 == 0 else village,
        "district": district,
        "guardian_name": f"{guardian_given} {guardian_surname}",
        "guardian_relationship": RELATIONSHIPS[index % len(RELATIONSHIPS)],
        "guardian_phone": phone,
        "guardian_email": email,
        "blood_group": BLOOD[index % len(BLOOD)],
        "allergies": allergies,
        "medical_conditions": conditions,
    }


def generate_students(
    *,
    nursery_per_class: int = 30,
    primary_per_class: int = 70,
    use_streams: bool = True,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for level in NURSERY_LEVELS:
        for i in range(nursery_per_class):
            rows.append(student_row(level, i, per_class=nursery_per_class, use_streams=False))
    for level in PRIMARY_LEVELS:
        for i in range(primary_per_class):
            rows.append(student_row(level, i, per_class=primary_per_class, use_streams=use_streams))
    return rows


def generate_staff(*, teacher_count: int = 15) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for i in range(teacher_count):
        name, slug = TEACHER_NAMES[i % len(TEACHER_NAMES)]
        if i >= len(TEACHER_NAMES):
            name = f"Teacher {SURNAMES[i % len(SURNAMES)]}"
            slug = f"teacher{i + 1}"
        rows.append({
            "login_id": f"{101 + i:04d}",
            "name": name if i < len(TEACHER_NAMES) else name,
            "email": f"{slug}@school.ug",
            "role_key": "teacher",
        })
    rows.append({"login_id": "0201", "name": "Peter Bursar", "email": "peter.bursar@school.ug", "role_key": "bursar"})
    rows.append({"login_id": "0301", "name": "Deputy Head Namuli", "email": "deputy@school.ug", "role_key": "deputy_head"})
    return rows


def write_csv(path: Path, header: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    students = generate_students(nursery_per_class=30, primary_per_class=70, use_streams=True)
    staff = generate_staff(teacher_count=15)

    write_csv(OUT / "students-import.csv", STUDENT_HEADER, students)
    write_csv(OUT / "staff-import.csv", STAFF_HEADER, staff)

    nursery = len(NURSERY_LEVELS) * 30
    primary = len(PRIMARY_LEVELS) * 70
    print(f"Wrote {OUT / 'students-import.csv'} — {len(students)} rows ({nursery} nursery + {primary} primary)")
    print(f"Wrote {OUT / 'staff-import.csv'} — {len(staff)} rows (15 teachers + bursar + deputy head)")


if __name__ == "__main__":
    main()
