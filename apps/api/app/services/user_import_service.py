"""Bulk user import — teachers and guardians."""
from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import UserStatus
from app.models.school import School
from app.models.student import Student
from app.models.user import Role, TenantUser
from app.schemas.tenant_user import (
    GuardianImportRow,
    ImportRowResult,
    ImportUsersResponse,
    TeacherImportRow,
)
from app.services import email_service
from app.services.tenant_user_service import (
    _resolve_role,
    _school_code,
    _temp_password,
)

STAFF_IMPORT_ROLES = frozenset({"teacher", "deputy_head", "bursar"})
STUDENT_NUMBER_RE = re.compile(r"^\d{4,20}$")


async def _login_taken(session: AsyncSession, tenant_id: UUID, login_id: str) -> bool:
    existing = await session.scalar(
        select(TenantUser.id).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.login_id == login_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    return existing is not None


async def _school_name(session: AsyncSession, tenant_id: UUID) -> str:
    code = await _school_code(session, tenant_id)
    name = await session.scalar(select(School.name).where(School.tenant_id == tenant_id))
    return name or code


async def _send_staff_credentials(
    *,
    to: str,
    school_name: str,
    username: str,
    password: str,
    name: str,
) -> bool:
    return await email_service.send_portal_credentials(
        to=to,
        school_name=school_name,
        username=username,
        password=password,
        intro=(
            f"Your SkulPulse portal account for {school_name} is ready. "
            f"Hello {name}, sign in with the credentials below, then choose a new password."
        ),
    )


async def _get_student(
    session: AsyncSession,
    tenant_id: UUID,
    row: GuardianImportRow,
) -> tuple[Student | None, str | None]:
    number = row.student_number.strip()
    if not STUDENT_NUMBER_RE.match(number):
        return None, "student_number must be 4–20 digits"

    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.student_number == number,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        return None, (
            f"Student #{number} is not enrolled — import pupils under Students first, "
            "then link guardian accounts."
        )
    return student, None


async def import_teachers(
    session: AsyncSession,
    tenant_id: UUID,
    rows: list[TeacherImportRow],
    *,
    default_password: str | None,
    generate_passwords: bool,
) -> ImportUsersResponse:
    school_code = await _school_code(session, tenant_id)
    school_name = await _school_name(session, tenant_id)
    results: list[ImportRowResult] = []
    created = skipped = failed = 0

    for i, row in enumerate(rows, start=1):
        login_id = row.login_id.strip()
        name = row.name.strip()
        role_key = row.role_key.strip() or "teacher"
        ident = login_id

        try:
            if not login_id or not name:
                raise ValueError("login_id and name are required")
            if not row.email:
                raise ValueError("email is required — credentials are sent there")
            if role_key not in STAFF_IMPORT_ROLES:
                raise ValueError(f"role_key must be one of: {', '.join(sorted(STAFF_IMPORT_ROLES))}")
            if await _login_taken(session, tenant_id, login_id):
                skipped += 1
                results.append(
                    ImportRowResult(
                        line=i,
                        identifier=ident,
                        status="skipped",
                        username=f"{login_id}@{school_code}",
                        message="Login ID already exists.",
                    )
                )
                continue

            role = await _resolve_role(session, role_key)
            password = default_password if default_password else (_temp_password() if generate_passwords else None)
            if not password or len(password) < 8:
                raise ValueError("Provide default_password (min 8 chars) or enable generate_passwords")

            user = TenantUser(
                tenant_id=tenant_id,
                role_id=role.id,
                login_id=login_id,
                email=str(row.email),
                password_hash=hash_password(password),
                name=name,
                status=UserStatus.active,
                must_change_password=True,
            )
            session.add(user)
            await session.flush()
            username = f"{login_id}@{school_code}"
            email_sent = await _send_staff_credentials(
                to=str(row.email),
                school_name=school_name,
                username=username,
                password=password,
                name=name,
            )
            created += 1
            results.append(
                ImportRowResult(
                    line=i,
                    identifier=ident,
                    status="created",
                    username=username,
                    temporary_password=None if email_sent else password,
                    email_sent=email_sent,
                    message=(
                        "Credentials emailed."
                        if email_sent
                        else "Email not sent — share the password manually (SMTP disabled or failed)."
                    ),
                )
            )
        except Exception as exc:
            failed += 1
            results.append(
                ImportRowResult(
                    line=i,
                    identifier=ident,
                    status="failed",
                    message=str(exc),
                )
            )

    return ImportUsersResponse(created=created, skipped=skipped, failed=failed, results=results)


async def import_guardians(
    session: AsyncSession,
    tenant_id: UUID,
    rows: list[GuardianImportRow],
    *,
    default_password: str | None,
    generate_passwords: bool,
) -> ImportUsersResponse:
    school_code = await _school_code(session, tenant_id)
    parent_role = await _resolve_role(session, "parent")
    results: list[ImportRowResult] = []
    created = skipped = failed = 0

    for i, row in enumerate(rows, start=1):
        number = row.student_number.strip()
        ident = number

        try:
            student, err = await _get_student(session, tenant_id, row)
            if err:
                raise ValueError(err)
            assert student is not None

            if await _login_taken(session, tenant_id, number):
                skipped += 1
                results.append(
                    ImportRowResult(
                        line=i,
                        identifier=ident,
                        status="skipped",
                        username=f"{number}@{school_code}",
                        message="Portal account already exists for this student number.",
                    )
                )
                continue

            password = default_password if default_password else (_temp_password() if generate_passwords else None)
            if not password or len(password) < 8:
                raise ValueError("Provide default_password (min 8 chars) or enable generate_passwords")

            user = TenantUser(
                tenant_id=tenant_id,
                role_id=parent_role.id,
                login_id=number,
                email=str(row.email) if row.email else None,
                password_hash=hash_password(password),
                name=row.guardian_name.strip(),
                status=UserStatus.active,
                must_change_password=True,
            )
            session.add(user)
            await session.flush()
            created += 1
            results.append(
                ImportRowResult(
                    line=i,
                    identifier=ident,
                    status="created",
                    username=f"{number}@{school_code}",
                    temporary_password=password if generate_passwords or default_password else None,
                )
            )
        except Exception as exc:
            failed += 1
            results.append(
                ImportRowResult(
                    line=i,
                    identifier=ident,
                    status="failed",
                    message=str(exc),
                )
            )

    return ImportUsersResponse(created=created, skipped=skipped, failed=failed, results=results)
