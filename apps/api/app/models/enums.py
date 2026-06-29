"""Enum types shared by models and the Alembic migration."""
from __future__ import annotations

import enum


class TenantStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    suspended = "suspended"
    inactive = "inactive"


class Ownership(str, enum.Enum):
    government = "government"
    private = "private"
    government_aided = "government_aided"


class RegistrationStatus(str, enum.Enum):
    pending = "pending"
    licensed = "licensed"
    registered = "registered"
    unknown = "unknown"


class BoardingStatus(str, enum.Enum):
    day = "day"
    boarding = "boarding"
    mixed = "mixed"


class SexComposition(str, enum.Enum):
    boys = "boys"
    girls = "girls"
    mixed = "mixed"


class UserStatus(str, enum.Enum):
    active = "active"
    invited = "invited"
    disabled = "disabled"


class UserType(str, enum.Enum):
    platform_admin = "platform_admin"
    tenant_user = "tenant_user"


class AcademicYearStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    archived = "archived"


class TermStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    closed = "closed"


class TermCalendarEventType(str, enum.Enum):
    short_holiday = "short_holiday"
    visitation = "visitation"
    class_meeting = "class_meeting"
    sports_day = "sports_day"
    exam_period = "exam_period"
    opening_day = "opening_day"
    closing_day = "closing_day"
    other = "other"


class CircularStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class CircularAudience(str, enum.Enum):
    all_parents = "all_parents"
    class_ = "class"
    stream = "stream"


class CircularPriority(str, enum.Enum):
    normal = "normal"
    important = "important"


class EmploymentType(str, enum.Enum):
    permanent = "permanent"
    contract = "contract"
    casual = "casual"


class EmployeeDepartment(str, enum.Enum):
    teaching = "teaching"
    administration = "administration"
    support = "support"
    leadership = "leadership"


class PaymentMethod(str, enum.Enum):
    bank = "bank"
    mobile_money = "mobile_money"
    cash = "cash"


class LeaveRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class PayrollRunStatus(str, enum.Enum):
    draft = "draft"
    finalized = "finalized"


class NcdcCycle(str, enum.Enum):
    """NCDC curriculum cycle — ECD nursery and primary (§2.3)."""
    ecd = "ecd"  # Baby, Middle, Top — early childhood
    cycle_1 = "cycle_1"  # P1–P3 thematic
    cycle_2 = "cycle_2"  # P4 transition
    cycle_3 = "cycle_3"  # P5–P7 subject-based


class ClassLevel(str, enum.Enum):
    """Uganda nursery (ECD) and primary class levels."""
    BABY = "BABY"
    MIDDLE = "MIDDLE"
    TOP = "TOP"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"
    P5 = "P5"
    P6 = "P6"
    P7 = "P7"


class SubscriptionAction(str, enum.Enum):
    activated = "activated"
    deactivated = "deactivated"


class ActorType(str, enum.Enum):
    platform_admin = "platform_admin"
    tenant_user = "tenant_user"
    anonymous = "anonymous"
    system = "system"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"


# Names of the PG native enum types (must match the migration).
PG_ENUM_NAMES = {
    TenantStatus: "tenant_status",
    Ownership: "ownership",
    RegistrationStatus: "registration_status",
    BoardingStatus: "boarding_status",
    SexComposition: "sex_composition",
    UserStatus: "user_status",
    UserType: "user_type",
    AcademicYearStatus: "academic_year_status",
    TermStatus: "term_status",
    TermCalendarEventType: "term_calendar_event_type",
    CircularStatus: "circular_status",
    CircularAudience: "circular_audience",
    CircularPriority: "circular_priority",
    EmploymentType: "employment_type",
    EmployeeDepartment: "employee_department",
    PaymentMethod: "payment_method",
    LeaveRequestStatus: "leave_request_status",
    PayrollRunStatus: "payroll_run_status",
    NcdcCycle: "ncdc_cycle",
    ClassLevel: "class_level",
    AttendanceStatus: "attendance_status",
    SubscriptionAction: "subscription_action",
    ActorType: "actor_type",
}
