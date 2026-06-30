"""Static seed reference data: roles, module catalog, Uganda geography (§2, §4.2).

Module keys follow BUILD-GUIDE §4.2 (underscored); prices in UGX per term align
with the prototype catalog.
"""
from __future__ import annotations

# (role_key, name, description, is_platform_role)
ROLES: list[tuple[str, str, str, bool]] = [
    ("platform_admin", "Platform Admin", "SkulPulse super admin — manages all schools", True),
    ("school_admin", "School Administrator", "Full access to subscribed modules", False),
    ("deputy_head", "Deputy Head Teacher", "Academic oversight, limited admin", False),
    ("teacher", "Teacher", "Classes, assessment, attendance", False),
    ("bursar", "Bursar / Accountant", "Finance module access", False),
    ("parent", "Parent / Guardian", "Report cards, fees, communication", False),
]

# (module_key, name, category, price_per_term_ugx, description)
MODULE_CATALOG: list[tuple[str, str, str, int, str]] = [
    ("core", "Core Platform", "base", 0,
     "Dashboard, users, academic year isolation, audit logs (requires platform base fee)"),
    ("students", "Student Management", "academic", 150_000,
     "Enrollment, profiles, class placement, guardians"),
    ("teachers", "Teacher & Staff", "academic", 120_000,
     "Staff records, qualifications, subject assignments"),
    ("academics", "Academic Structure", "academic", 100_000,
     "Classes, streams, subjects, NCDC curriculum mapping"),
    ("assessment", "Assessment & Grading", "academic", 180_000,
     "Continuous assessment, exams, grade computation"),
    ("attendance", "Attendance", "academic", 80_000,
     "Daily roll call, absence alerts, analytics"),
    ("reportcards", "Report Cards & Transcripts", "operations", 200_000,
     "Term reports, PDF export, and transcripts"),
    ("parents_portal", "Parent Portal", "operations", 1_350_000,
     "Guardian logins, child dashboard, circulars, report cards, and fee summaries"),
    ("finance", "Finance & Fees", "operations", 250_000,
     "Fee structures, invoicing, MTN/Airtel MoMo, bursar reports"),
    ("communication", "Communication Hub", "operations", 150_000,
     "SMS, email, in-app messaging, announcements"),
    ("admissions", "Admissions Pipeline", "operations", 120_000,
     "Online applications, interview scheduling, enrollment workflow"),
    ("timetable", "Timetable", "operations", 100_000,
     "Class schedules, room allocation, conflict detection"),
    ("moes_reporting", "MoES Compliance Reports", "operations", 100_000,
     "Ministry-ready exports, EMIS sync"),
    ("ai_analytics", "AI Performance Analytics", "intelligence", 350_000,
     "At-risk prediction, performance forecasting, intervention suggestions"),
    ("library", "Library", "addon", 60_000, "Catalogue, lending, overdue tracking"),
    ("transport", "Transport", "addon", 80_000, "Routes, vehicles, student pickup tracking"),
    ("hostel", "Boarding & Hostel", "addon", 90_000,
     "Dormitory allocation, roll call, meal plans"),
    ("hr_payroll", "HR & Payroll", "addon", 200_000, "Leave, payroll, NSSF, PAYE compliance"),
    ("inventory", "Inventory & Assets", "addon", 70_000,
     "Stock, lab equipment, asset tracking"),
]

# Uganda regions and a representative set of districts (full hierarchy loads from
# CSV later — §2.2). { region: [districts] }
UGANDA_GEO: dict[str, list[str]] = {
    "Central": [
        "Kampala", "Wakiso", "Mukono", "Masaka", "Mpigi", "Luwero", "Mubende",
        "Kayunga", "Nakaseke", "Buikwe",
    ],
    "Eastern": [
        "Jinja", "Mbale", "Soroti", "Tororo", "Iganga", "Busia", "Kamuli",
        "Pallisa", "Kapchorwa", "Bugiri",
    ],
    "Northern": [
        "Gulu", "Lira", "Arua", "Kitgum", "Apac", "Nebbi", "Adjumani",
        "Moroto", "Kotido", "Pader",
    ],
    "Western": [
        "Mbarara", "Kabarole", "Kasese", "Bushenyi", "Hoima", "Masindi",
        "Kabale", "Fort Portal", "Ntungamo", "Rukungiri",
    ],
}
