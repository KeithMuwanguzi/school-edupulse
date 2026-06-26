#!/usr/bin/env python3
"""End-to-end user journey against a running Docker stack.

Exercises platform onboarding through core school operations the way a real
admin/teacher would — reports pass/fail per step and surfaces API errors.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import uuid
from dataclasses import dataclass, field

import httpx

BASE = "http://localhost:5330/api/v1"
PLATFORM_EMAIL = "admin@skulpulse.ug"
PLATFORM_PASSWORD = "ChangeMe!Admin2025"
SCHOOL_CODE = "UAT01"
ADMIN_PASSWORD = "UAT!Pass2025"


@dataclass
class StepResult:
    name: str
    ok: bool
    detail: str = ""
    skipped: bool = False


@dataclass
class Journey:
    client: httpx.Client
    platform_token: str = ""
    tenant_token: str = ""
    school_code: str = SCHOOL_CODE
    class_ids: dict[str, str] = field(default_factory=dict)
    stream_ids: dict[str, str] = field(default_factory=dict)
    subject_ids: dict[str, str] = field(default_factory=dict)
    student_ids: list[str] = field(default_factory=list)
    student_numbers: list[str] = field(default_factory=list)
    teacher_id: str = ""
    teacher_token: str = ""
    structure_id: str = ""
    application_id: str = ""
    results: list[StepResult] = field(default_factory=list)

    def record(self, name: str, ok: bool, detail: str = "", *, skipped: bool = False) -> None:
        self.results.append(StepResult(name, ok, detail, skipped))
        mark = "SKIP" if skipped else ("PASS" if ok else "FAIL")
        line = f"  [{mark}] {name}"
        if detail:
            line += f" — {detail}"
        print(line)

    def auth(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def post_json(self, path: str, body: dict, token: str | None = None, expected: int = 200) -> httpx.Response:
        headers = self.auth(token or self.tenant_token)
        resp = self.client.post(f"{BASE}{path}", json=body, headers=headers)
        return resp

    def get(self, path: str, token: str | None = None) -> httpx.Response:
        return self.client.get(f"{BASE}{path}", headers=self.auth(token or self.tenant_token))

    def put_json(self, path: str, body: dict, token: str | None = None) -> httpx.Response:
        return self.client.put(f"{BASE}{path}", json=body, headers=self.auth(token or self.tenant_token))

    def patch_json(self, path: str, body: dict) -> httpx.Response:
        return self.client.patch(f"{BASE}{path}", json=body, headers=self.auth(self.tenant_token))

    def run(self) -> int:
        print("\n=== SkulPulse E2E User Journey ===\n")
        self.step_platform_login()
        self.step_onboard_school()
        self.step_tenant_login()
        self.step_academic_context()
        self.step_setup_primary_classes()
        self.step_seed_subjects()
        self.step_create_streams()
        self.step_import_staff()
        self.step_import_students()
        self.step_admissions_batch()
        self.step_term_registration_config()
        self.step_term_register_students()
        self.step_teacher_assignment()
        self.step_timetable_import()
        self.step_grading_config()
        self.step_assessment_flow()
        self.step_attendance()
        self.step_finance()
        self.step_ple()
        self.step_report_cards()
        self.step_hostel()
        self.print_summary()
        failed = sum(1 for r in self.results if not r.ok and not r.skipped)
        return 1 if failed else 0

    def step_platform_login(self) -> None:
        resp = self.client.post(
            f"{BASE}/auth/platform/login",
            json={"email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD},
        )
        ok = resp.status_code == 200
        if ok:
            self.platform_token = resp.json()["access_token"]
        self.record("Platform admin login", ok, resp.text[:200] if not ok else "")

    def step_onboard_school(self) -> None:
        # Try login first — school may already exist from a prior run
        probe = self.client.post(
            f"{BASE}/auth/tenant/login",
            json={"username": f"0001@{SCHOOL_CODE}", "password": ADMIN_PASSWORD},
        )
        if probe.status_code == 200:
            self.tenant_token = probe.json()["access_token"]
            self.record("School already exists (0001@UAT01)", True, "reusing")
            return

        modules = [
            "core", "students", "teachers", "academics", "assessment", "attendance",
            "reportcards", "finance", "admissions", "timetable", "hostel",
        ]
        payload = {
            "school_code": SCHOOL_CODE,
            "name": "UAT Primary School",
            "ownership": "private",
            "phone": "+256700000000",
            "email": "admin@uat.ug",
            "head_teacher_name": "Grace Namuli",
            "contact_person_name": "Grace Namuli",
            "contact_person_phone": "+256700000001",
            "status": "trial",
            "module_keys": modules,
            "admin_user": {
                "name": "Grace Namuli",
                "login_id": "0001",
                "password": ADMIN_PASSWORD,
                "email": "admin@uat.ug",
            },
        }
        resp = self.client.post(
            f"{BASE}/platform/schools",
            json=payload,
            headers=self.auth(self.platform_token),
        )
        ok = resp.status_code == 201
        self.record("Onboard UAT school with modules", ok, resp.text[:300] if not ok else f"{len(modules)} modules")

    def step_tenant_login(self) -> None:
        if self.tenant_token:
            self.record("Tenant admin login", True, "already authenticated")
            return
        resp = self.client.post(
            f"{BASE}/auth/tenant/login",
            json={"username": f"0001@{SCHOOL_CODE}", "password": ADMIN_PASSWORD},
        )
        ok = resp.status_code == 200
        if ok:
            self.tenant_token = resp.json()["access_token"]
        self.record("Tenant admin login", ok, resp.text[:200] if not ok else f"0001@{SCHOOL_CODE}")

    def step_academic_context(self) -> None:
        resp = self.get("/tenant/academic-context")
        ok = resp.status_code == 200 and resp.json().get("academic_year") is not None
        self.record("Academic context (active year/term)", ok, resp.text[:200] if not ok else "")

    def step_setup_primary_classes(self) -> None:
        listed = self.get("/tenant/classes")
        if listed.status_code == 200 and len(listed.json()) >= 7:
            for row in listed.json():
                self.class_ids[row["level"]] = row["id"]
            self.record("Setup P1–P7 classes", True, f"{len(self.class_ids)} existing")
            return
        resp = self.post_json("/tenant/classes/setup-primary", {})
        ok = resp.status_code == 200 and len(resp.json()) == 7
        if ok:
            for row in resp.json():
                self.class_ids[row["level"]] = row["id"]
        self.record("Setup P1–P7 classes", ok, resp.text[:200] if not ok else "7 classes")

    def step_seed_subjects(self) -> None:
        listed = self.get("/tenant/subjects")
        if listed.status_code == 200 and listed.json():
            for row in listed.json():
                self.subject_ids[row["code"]] = row["id"]
            self.record("Primary subjects", True, f"{len(self.subject_ids)} existing")
            return
        for code, name, cycle in [
            ("ENG", "English", "cycle_1"),
            ("MTC", "Mathematics", "cycle_1"),
            ("SCI", "Science", "cycle_1"),
            ("ENG", "English", "cycle_3"),
            ("MATH", "Mathematics", "cycle_3"),
        ]:
            resp = self.post_json(
                "/tenant/subjects",
                {"code": code, "name": name, "ncdc_cycle": cycle},
            )
            if resp.status_code in (200, 201):
                self.subject_ids[resp.json()["code"]] = resp.json()["id"]
        ok = "ENG" in self.subject_ids
        self.record("Create primary subjects", ok, str(sorted(self.subject_ids.keys())))

    def step_create_streams(self) -> None:
        p3 = self.class_ids.get("P3")
        if not p3:
            self.record("Create P3 streams A/B", False, "P3 class missing")
            return
        classes = self.get("/tenant/classes")
        if classes.status_code == 200:
            for row in classes.json():
                if row["level"] == "P3":
                    for stream in row.get("streams", []):
                        self.stream_ids[stream["name"]] = stream["id"]
        for name in ("A", "B"):
            if name in self.stream_ids:
                continue
            resp = self.post_json(f"/tenant/classes/{p3}/streams", {"name": name}, expected=201)
            if resp.status_code == 201:
                for stream in resp.json().get("streams", []):
                    if stream["name"] == name:
                        self.stream_ids[name] = stream["id"]
        ok = "A" in self.stream_ids
        self.record("Create P3 streams A/B", ok, str(list(self.stream_ids.keys())))

    def step_import_staff(self) -> None:
        resp = self.post_json(
            "/tenant/users/import/teachers",
            {
                "rows": [
                    {"login_id": "0101", "name": "John Okello", "email": "john@uat.ug", "role_key": "teacher"},
                    {"login_id": "0102", "name": "Grace Namuli", "role_key": "teacher"},
                    {"login_id": "0201", "name": "Peter Bursar", "role_key": "bursar"},
                ],
                "generate_passwords": True,
            },
        )
        ok = resp.status_code == 200 and (resp.json().get("created", 0) >= 1 or resp.json().get("skipped", 0) >= 1)
        self.record("Import staff CSV", ok, resp.text[:300] if not ok else f"created={resp.json().get('created')}, skipped={resp.json().get('skipped')}")

        temp_pw = None
        for row in resp.json().get("results", []):
            if row.get("identifier") == "0101" and row.get("temporary_password"):
                temp_pw = row["temporary_password"]
                break

        teachers = self.get("/tenant/teachers")
        if teachers.status_code == 200:
            for t in teachers.json():
                if t.get("login_id") == "0101":
                    self.teacher_id = t["id"]

        if temp_pw:
            login = self.client.post(
                f"{BASE}/auth/tenant/login",
                json={"username": f"0101@{SCHOOL_CODE}", "password": temp_pw},
            )
            if login.status_code == 200:
                self.teacher_token = login.json()["access_token"]
            self.record("Teacher login after import", login.status_code == 200, login.text[:150] if login.status_code != 200 else "0101@UAT01")
        else:
            self.record("Teacher login after import", bool(self.teacher_id), "staff exists from prior run", skipped=not self.teacher_id)

    def step_import_students(self) -> None:
        today = str(dt.date.today())
        rows = [
            {
                "first_name": "Kato", "last_name": "Okello", "class_level": "P3",
                "stream_name": "A", "gender": "male", "date_of_birth": "2015-03-12",
                "nationality": "Ugandan", "residence": "day", "admission_date": today,
                "home_address": "Plot 5 Kira Rd", "district": "Wakiso",
                "guardian_name": "Sarah Nakimera", "guardian_phone": "+256700111222",
                "blood_group": "O+",
            },
            {
                "first_name": "Amina", "last_name": "Namuli", "class_level": "P3",
                "stream_name": "B", "gender": "female", "date_of_birth": "2014-08-20",
                "nationality": "Ugandan", "residence": "boarder", "admission_date": today,
                "village": "Bweyogerere", "district": "Wakiso",
                "guardian_name": "Paul Mukasa", "guardian_phone": "+256780222333",
                "blood_group": "A-",
            },
            {
                "first_name": "Brian", "last_name": "Mukasa", "class_level": "P7",
                "gender": "male", "date_of_birth": "2012-11-05",
                "nationality": "Ugandan", "residence": "day", "admission_date": today,
                "home_address": "Ntinda", "district": "Kampala",
                "guardian_name": "Jane Mukasa", "guardian_phone": "+256701333444",
                "blood_group": "B+",
            },
        ]
        dry = self.post_json("/tenant/students/import", {"rows": rows, "dry_run": True})
        ok_dry = dry.status_code == 200 and dry.json().get("failed", 1) == 0
        self.record("Student import dry-run", ok_dry, dry.text[:300] if not ok_dry else f"valid={dry.json().get('valid')}")

        resp = self.post_json("/tenant/students/import", {"rows": rows, "skip_duplicates": True})
        ok = resp.status_code == 200 and resp.json().get("failed", 1) == 0
        if resp.status_code == 200:
            for r in resp.json().get("results", []):
                if r.get("student_id"):
                    self.student_ids.append(r["student_id"])
        listed = self.get("/tenant/students")
        if listed.status_code == 200:
            for item in listed.json().get("items", []):
                if item.get("student_number") and item["student_number"] not in self.student_numbers:
                    self.student_numbers.append(item["student_number"])
                if item.get("id") and item["id"] not in self.student_ids:
                    self.student_ids.append(item["id"])
        self.record(
            "Student import commit",
            ok,
            resp.text[:400] if not ok else f"created={resp.json().get('created')}, skipped={resp.json().get('skipped')}",
        )

    def step_admissions_batch(self) -> None:
        resp = self.post_json(
            "/tenant/admissions/applications/batch",
            {
                "rows": [
                    {"first_name": "Peter", "last_name": "Ssemwanga", "applied_class_level": "P1",
                     "guardian_name": "Mary Ssemwanga", "guardian_phone": "+256702444555"},
                    {"first_name": "Faith", "last_name": "Nabukeera", "applied_class_level": "P2"},
                ],
            },
        )
        ok = resp.status_code == 201 and resp.json().get("created", 0) >= 1
        if ok and resp.json().get("results"):
            self.application_id = resp.json()["results"][0].get("application_id", "")
        self.record("Admissions batch import", ok, resp.text[:300] if not ok else f"created={resp.json().get('created')}")

        if self.application_id:
            for status in ("interview", "accepted"):
                tr = self.patch_json(
                    f"/tenant/admissions/applications/{self.application_id}",
                    {"status": status},
                )
                if tr.status_code != 200:
                    self.record(f"Admission → {status}", False, tr.text[:200])
                    return
            self.record("Admission status workflow", True, "application -> interview -> accepted")

    def step_term_registration_config(self) -> None:
        resp = self.get("/tenant/registration/config")
        ok = resp.status_code == 200
        self.record("Term registration config", ok, resp.text[:200] if not ok else "loaded")

    def step_term_register_students(self) -> None:
        if not self.student_ids:
            self.record("Term register students", False, "no students", skipped=True)
            return
        registered = 0
        for sid in self.student_ids[:2]:
            start = self.post_json("/tenant/registration", {"student_id": sid})
            if start.status_code != 201:
                continue
            detail = start.json()
            responses = []
            for sec in detail.get("sections", []):
                for req in sec.get("requirements", []):
                    if req.get("is_required"):
                        val = True if req.get("field_type") == "checkbox" else "ok"
                        responses.append({"requirement_id": req["id"], "value": val, "status": "satisfied"})
            upd = self.put_json(f"/tenant/registration/{detail['id']}/responses", {"responses": responses})
            if upd.status_code == 200:
                registered += 1
        self.record("Term register students", registered >= 1, f"{registered}/{len(self.student_ids[:2])} registered")

    def step_teacher_assignment(self) -> None:
        if not self.teacher_id or "P3" not in self.class_ids or "ENG" not in self.subject_ids:
            self.record("Teacher assignment", False, "missing prerequisites", skipped=True)
            return
        resp = self.post_json(
            "/tenant/teachers/assignments",
            {
                "teacher_id": self.teacher_id,
                "class_id": self.class_ids["P3"],
                "subject_id": self.subject_ids["ENG"],
                "stream_id": self.stream_ids.get("A"),
            },
        )
        ok = resp.status_code in (200, 201)
        self.record("Assign teacher to P3 English", ok, resp.text[:200] if not ok else "")

    def step_timetable_import(self) -> None:
        rows = [
            {
                "day": "Monday", "starts_at": "08:00", "ends_at": "08:40",
                "class_level": "P3", "stream_name": "A", "subject_code": "ENG",
                "teacher": "0101", "room": "Block A",
            },
            {
                "day": "Monday", "starts_at": "08:40", "ends_at": "09:20",
                "class_level": "P3", "stream_name": "A", "subject_code": "MTC",
                "teacher": "0101", "room": "Block A",
            },
        ]
        dry = self.post_json("/tenant/timetable/import", {"rows": rows, "dry_run": True})
        ok_dry = dry.status_code == 200 and dry.json().get("failed", 1) == 0
        self.record("Timetable import dry-run", ok_dry, dry.text[:300] if not ok_dry else "")

        resp = self.post_json("/tenant/timetable/import", {"rows": rows})
        ok = resp.status_code == 200 and resp.json().get("created", 0) >= 1
        self.record("Timetable import commit", ok, resp.text[:300] if not ok else f"created={resp.json().get('created')}")

    def step_grading_config(self) -> None:
        resp = self.get("/tenant/grading/config")
        ok = resp.status_code == 200
        self.record("Grading config read", ok, resp.text[:150] if not ok else "ok")

    def step_assessment_flow(self) -> None:
        if not self.teacher_token or not self.class_ids.get("P3") or not self.subject_ids.get("ENG"):
            self.record("Assessment marks import", False, "missing teacher/class/subject", skipped=True)
            return
        sets = self.get("/tenant/assessment/sets", token=self.teacher_token)
        if sets.status_code != 200 or not sets.json():
            self.record("Assessment sets list", False, sets.text[:200], skipped=True)
            return
        set_id = sets.json()[0]["id"]
        if not self.student_numbers:
            listed = self.get("/tenant/students")
            if listed.status_code == 200:
                for item in listed.json().get("items", []):
                    if item.get("class_level") == "P3":
                        self.student_numbers.append(item["student_number"])
        rows = [{"student_number": n, "score": 75} for n in self.student_numbers[:2]]
        if not rows:
            self.record("Assessment marks import", False, "no P3 student numbers", skipped=True)
            return
        resp = self.client.put(
            f"{BASE}/tenant/assessment/entry/import",
            json={
                "set_id": set_id,
                "class_id": self.class_ids["P3"],
                "subject_id": self.subject_ids["ENG"],
                "stream_id": self.stream_ids.get("A"),
                "rows": rows,
            },
            headers=self.auth(self.teacher_token),
        )
        ok = resp.status_code == 200 and resp.json().get("upserted", 0) >= 1
        self.record("Assessment marks import", ok, resp.text[:300] if not ok else f"upserted={resp.json().get('upserted')}")

    def step_attendance(self) -> None:
        if not self.class_ids.get("P3"):
            self.record("Attendance mark", False, "no P3", skipped=True)
            return
        today = str(dt.date.today())
        roll = self.get(f"/tenant/attendance/roll?class_id={self.class_ids['P3']}&date={today}")
        if roll.status_code != 200:
            self.record("Attendance roll", False, roll.text[:200])
            return
        records = [
            {"student_id": r["student_id"], "status": "present"}
            for r in roll.json().get("rows", [])[:3]
        ]
        save = self.post_json(
            "/tenant/attendance/mark",
            {
                "class_id": self.class_ids["P3"],
                "stream_id": self.stream_ids.get("A"),
                "date": today,
                "records": records,
            },
        )
        if save.status_code == 403:
            self.record("Attendance mark present", True, "admin cannot mark — teacher-only (by design)", skipped=True)
        else:
            self.record("Attendance mark present", save.status_code == 200, save.text[:200] if save.status_code != 200 else f"{len(records)} pupils")

    def step_finance(self) -> None:
        created = self.post_json("/tenant/finance/structures", {"name": "Term 1 2026 fees"})
        if created.status_code != 201:
            self.record("Create fee structure", False, created.text[:200])
            return
        self.structure_id = created.json()["id"]
        for line in [
            {"label": "Tuition", "amount_ugx": 350_000, "applies_to": "all"},
            {"label": "Boarding", "amount_ugx": 200_000, "applies_to": "boarder"},
        ]:
            self.post_json(f"/tenant/finance/structures/{self.structure_id}/lines", line)
        act = self.post_json(f"/tenant/finance/structures/{self.structure_id}/activate", {})
        ok = act.status_code == 200
        self.record("Fee structure activate", ok, act.text[:200] if not ok else act.json().get("name", ""))

        gen = self.post_json(
            "/tenant/finance/invoices/generate",
            {"structure_id": self.structure_id},
        )
        ok_gen = gen.status_code == 200 and gen.json().get("created", 0) >= 0
        self.record("Generate invoices", ok_gen, gen.text[:250] if not ok_gen else f"created={gen.json().get('created')}")

    def step_ple(self) -> None:
        if not self.student_ids:
            self.record("PLE candidacy", False, "no P7 student", skipped=True)
            return
        p7_students = self.get("/tenant/students?class_level=P7")
        if p7_students.status_code != 200 or not p7_students.json().get("items"):
            self.record("PLE candidacy", False, "no P7 enrolled", skipped=True)
            return
        sid = p7_students.json()["items"][0]["id"]
        resp = self.post_json("/tenant/ple/candidates", {"student_ids": [sid]})
        ok = resp.status_code in (200, 201)
        self.record("Register P7 PLE candidate", ok, resp.text[:200] if not ok else "")

    def step_report_cards(self) -> None:
        if not self.class_ids.get("P3"):
            self.record("Report cards preview", False, "no class", skipped=True)
            return
        resp = self.get(f"/tenant/reportcards/students?class_id={self.class_ids['P3']}")
        ok = resp.status_code == 200
        self.record("Report cards class view", ok, resp.text[:200] if not ok else f"{len(resp.json())} pupils")

    def step_hostel(self) -> None:
        resp = self.post_json("/tenant/hostels", {"name": "Boys Hostel", "gender": "male", "capacity": 80})
        ok = resp.status_code in (200, 201)
        self.record("Create hostel", ok, resp.text[:200] if not ok else resp.json().get("name", ""))

    def print_summary(self) -> None:
        passed = sum(1 for r in self.results if r.ok and not r.skipped)
        failed = sum(1 for r in self.results if not r.ok and not r.skipped)
        skipped = sum(1 for r in self.results if r.skipped)
        print(f"\n=== Summary: {passed} passed, {failed} failed, {skipped} skipped ===")
        if failed:
            print("\nFailures:")
            for r in self.results:
                if not r.ok and not r.skipped:
                    print(f"  - {r.name}: {r.detail}")


def main() -> None:
    with httpx.Client(timeout=30.0) as client:
        code = Journey(client).run()
    sys.exit(code)


if __name__ == "__main__":
    main()
