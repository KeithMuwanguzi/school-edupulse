"""SQLAlchemy models. Import order ensures all tables register on Base.metadata."""
from app.models.base import Base
from app.models.platform import (
    ModuleCatalog,
    PlatformAdmin,
    PlatformConfig,
    Tenant,
)
from app.models.geo import County, District, Parish, Region, SubCounty
from app.models.school import School
from app.models.user import RefreshToken, Role, TenantUser
from app.models.subscription import SchoolModuleSubscription, SubscriptionChangeLog
from app.models.academic import AcademicYear, Term
from app.models.subject import Subject
from app.models.student import (
    Student,
    StudentDisciplineRecord,
    StudentGuardian,
    StudentHealth,
)
from app.models.school_class import ClassStream, SchoolClass
from app.models.attendance import AttendanceRecord
from app.models.audit import AuditLog
from app.models.logs import ApiRequestLog, ErrorLog, IdempotencyRecord
from app.models.teacher_assignment import TeacherAssignment
from app.models.timetable import TimetableSlot
from app.models.term_registration import (
    RegistrationRequirement,
    RegistrationSection,
    StudentRegistrationResponse,
    StudentTermRegistration,
)
from app.models.admission import AdmissionApplication
from app.models.grading import AggregateDivision, GradeRange, GradingScale, SubjectGradingAssignment
from app.models.assessment import (
    AssessmentSet,
    CaSetInclusion,
    StudentAssessmentMark,
    TermCaPolicy,
)
from app.models.ple import PleCandidate
from app.models.hostel import Hostel, HostelRoom
from app.models.finance import (
    FeeInvoice,
    FeeInvoiceLine,
    FeePayment,
    FeeStructure,
    FeeStructureLine,
)

__all__ = [
    "Base",
    "Tenant",
    "PlatformAdmin",
    "ModuleCatalog",
    "PlatformConfig",
    "Region",
    "District",
    "County",
    "SubCounty",
    "Parish",
    "School",
    "Role",
    "TenantUser",
    "RefreshToken",
    "SchoolModuleSubscription",
    "SubscriptionChangeLog",
    "AcademicYear",
    "Term",
    "Subject",
    "Student",
    "StudentGuardian",
    "StudentHealth",
    "StudentDisciplineRecord",
    "SchoolClass",
    "ClassStream",
    "TeacherAssignment",
    "TimetableSlot",
    "RegistrationSection",
    "RegistrationRequirement",
    "StudentTermRegistration",
    "StudentRegistrationResponse",
    "AdmissionApplication",
    "GradingScale",
    "GradeRange",
    "AggregateDivision",
    "SubjectGradingAssignment",
    "AssessmentSet",
    "CaSetInclusion",
    "StudentAssessmentMark",
    "TermCaPolicy",
    "PleCandidate",
    "Hostel",
    "HostelRoom",
    "FeeStructure",
    "FeeStructureLine",
    "FeeInvoice",
    "FeeInvoiceLine",
    "FeePayment",
    "AttendanceRecord",
    "AuditLog",
    "ApiRequestLog",
    "ErrorLog",
    "IdempotencyRecord",
]
