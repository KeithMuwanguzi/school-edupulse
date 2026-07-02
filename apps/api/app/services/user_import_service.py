"""Bulk user import — teachers and guardians."""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
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


@dataclass
class _TeacherImportCache:
    taken_logins: set[str] = field(default_factory=set)
    roles: dict[str, Role] = field(default_factory=dict)


async def _load_teacher_import_cache(
    session: AsyncSession, tenant_id: UUID
) -> _TeacherImportCache:
    cache = _TeacherImportCache()
    logins = await session.scalars(
        select(TenantUser.login_id).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    cache.taken_logins = {login.strip() for login in logins if login}

    role_rows = list(
        await session.scalars(
            select(Role).where(Role.role_key.in_(tuple(STAFF_IMPORT_ROLES)))
        )
    )
    cache.roles = {role.role_key: role for role in role_rows}
    return cache


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
    line_offset: int = 0,
) -> ImportUsersResponse:
    school_code = await _school_code(session, tenant_id)
    school_name = await _school_name(session, tenant_id)
    cache = await _load_teacher_import_cache(session, tenant_id)
    results: list[ImportRowResult] = []
    created = skipped = failed = 0
    pending_emails: list[tuple[int, str, str, str, str]] = []

    for i, row in enumerate(rows, start=1):
        line = line_offset + i
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
            if login_id in cache.taken_logins:
                skipped += 1
                results.append(
                    ImportRowResult(
                        line=line,
                        identifier=ident,
                        status="skipped",
                        username=f"{login_id}@{school_code}",
                        message="Login ID already exists.",
                    )
                )
                continue

            role = cache.roles.get(role_key)
            if role is None:
                role = await _resolve_role(session, role_key)
                cache.roles[role_key] = role

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
            cache.taken_logins.add(login_id)
            created += 1
            pending_emails.append((line, str(row.email), username, password, name))
            results.append(
                ImportRowResult(
                    line=line,
                    identifier=ident,
                    status="created",
                    username=username,
                    temporary_password=password,
                    email_sent=None,
                    message="Credentials pending email.",
                )
            )
        except Exception as exc:
            failed += 1
            results.append(
                ImportRowResult(
                    line=line,
                    identifier=ident,
                    status="failed",
                    message=str(exc),
                )
            )

    if pending_emails:
        email_outcomes = await asyncio.gather(
            *[
                _send_staff_credentials(
                    to=email,
                    school_name=school_name,
                    username=username,
                    password=password,
                    name=name,
                )
                for _, email, username, password, name in pending_emails
            ],
            return_exceptions=True,
        )
        by_line = {line: idx for idx, (line, *_rest) in enumerate(pending_emails)}
        for result in results:
            if result.status != "created" or result.line not in by_line:
                continue
            idx = by_line[result.line]
            outcome = email_outcomes[idx]
            if isinstance(outcome, Exception) or not outcome:
                result.temporary_password = pending_emails[idx][3]
                result.email_sent = False
                result.message = (
                    "Email not sent — share the password manually (SMTP disabled or failed)."
                )
            else:
                result.temporary_password = None
                result.email_sent = True
                result.message = "Credentials emailed."

    return ImportUsersResponse(created=created, skipped=skipped, failed=failed, results=results)


async def import_guardians(
    session: AsyncSession,
    tenant_id: UUID,
    rows: list[GuardianImportRow],
    *,
    default_password: str | None,
    generate_passwords: bool,
) -> ImportUsersResponse:
    from app.services.parent_portal_accounts import assert_can_manage_parent_credentials

    await assert_can_manage_parent_credentials(session, tenant_id)
    school_code = await _school_code(session, tenant_id)
    parent_role = await _resolve_role(session, "parent")
    taken_logins = {
        login.strip()
        for login in await session.scalars(
            select(TenantUser.login_id).where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.deleted_at.is_(None),
            )
        )
        if login
    }
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

            if number in taken_logins:
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
            taken_logins.add(number)
            created += 1
            username = f"{number}@{school_code}"
            child_name = f"{student.first_name} {student.last_name}".strip()
            from app.services.parent_portal_accounts import notify_guardians_of_new_portal_account

            emails_sent = await notify_guardians_of_new_portal_account(
                session,
                tenant_id,
                student_id=student.id,
                username=username,
                password=password,
                extra_emails=[str(row.email)] if row.email else None,
                child_name=child_name,
            )
            message = None
            if emails_sent:
                message = "Credentials emailed to guardian(s)."
            elif row.email:
                message = "Email not sent — configure SMTP or share the password manually."
            results.append(
                ImportRowResult(
                    line=i,
                    identifier=ident,
                    status="created",
                    username=username,
                    temporary_password=password if not emails_sent else None,
                    email_sent=emails_sent > 0,
                    message=message,
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
