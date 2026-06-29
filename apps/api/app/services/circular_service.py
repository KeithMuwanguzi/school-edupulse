"""Parent circulars — compose, publish, and inbox delivery."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.circular import Circular
from app.models.enums import CircularAudience, CircularPriority, CircularStatus
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.user import Role, TenantUser
from app.schemas.circular import CircularCreate, CircularOut, CircularUpdate
from app.services import circular_attachment_service


def _labels(
    school_class: SchoolClass | None,
    stream: ClassStream | None,
) -> tuple[str | None, str | None]:
    class_label = None
    stream_label = None
    if school_class is not None:
        class_label = school_class.label
    if stream is not None:
        stream_label = stream.name
    return class_label, stream_label


def _circular_out(
    circular: Circular,
    *,
    school_class: SchoolClass | None = None,
    stream: ClassStream | None = None,
) -> CircularOut:
    class_label, stream_label = _labels(school_class, stream)
    return CircularOut(
        id=circular.id,
        title=circular.title,
        body=circular.body,
        status=circular.status.value,
        audience=circular.audience.value,
        priority=circular.priority.value,
        class_id=circular.class_id,
        class_label=class_label,
        stream_id=circular.stream_id,
        stream_label=stream_label,
        published_at=circular.published_at,
        published_by=circular.published_by,
        attachment_filename=circular.attachment_filename,
        has_attachment=circular_attachment_service.circular_attachment_path(
            circular.tenant_id, circular.id
        )
        is not None,
        created_at=circular.created_at,
        updated_at=circular.updated_at,
    )


async def _get_class(
    session: AsyncSession,
    tenant_id: UUID,
    class_id: UUID,
) -> SchoolClass:
    row = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.id == class_id,
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if row is None:
        raise ValidationError("Class not found.")
    return row


async def _get_stream(
    session: AsyncSession,
    tenant_id: UUID,
    class_id: UUID,
    stream_id: UUID,
) -> ClassStream:
    row = await session.scalar(
        select(ClassStream).where(
            ClassStream.id == stream_id,
            ClassStream.class_id == class_id,
            ClassStream.tenant_id == tenant_id,
            ClassStream.deleted_at.is_(None),
        )
    )
    if row is None:
        raise ValidationError("Stream not found.")
    return row


async def _get_circular(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
) -> Circular:
    row = await session.scalar(
        select(Circular).where(
            Circular.id == circular_id,
            Circular.tenant_id == tenant_id,
            Circular.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Circular not found.")
    return row


async def _hydrate_out(session: AsyncSession, circular: Circular) -> CircularOut:
    school_class = None
    stream = None
    if circular.class_id:
        school_class = await session.get(SchoolClass, circular.class_id)
    if circular.stream_id:
        stream = await session.get(ClassStream, circular.stream_id)
    return _circular_out(circular, school_class=school_class, stream=stream)


def _validate_audience_fields(
    audience: CircularAudience,
    class_id: UUID | None,
    stream_id: UUID | None,
) -> None:
    if audience == CircularAudience.all_parents:
        if class_id or stream_id:
            raise ValidationError("All-parent circulars cannot target a class or stream.")
    elif audience == CircularAudience.class_:
        if class_id is None:
            raise ValidationError("Class circulars require a class.")
    elif audience == CircularAudience.stream:
        if class_id is None or stream_id is None:
            raise ValidationError("Stream circulars require both class and stream.")


async def _resolve_audience_ids(
    session: AsyncSession,
    tenant_id: UUID,
    audience: CircularAudience,
    class_id: UUID | None,
    stream_id: UUID | None,
) -> tuple[UUID | None, UUID | None]:
    _validate_audience_fields(audience, class_id, stream_id)
    if audience == CircularAudience.class_ and class_id:
        await _get_class(session, tenant_id, class_id)
    if audience == CircularAudience.stream and class_id and stream_id:
        await _get_class(session, tenant_id, class_id)
        await _get_stream(session, tenant_id, class_id, stream_id)
    return class_id, stream_id


async def list_admin(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    status: CircularStatus | None = None,
) -> list[CircularOut]:
    stmt = (
        select(Circular)
        .where(Circular.tenant_id == tenant_id, Circular.deleted_at.is_(None))
        .order_by(Circular.updated_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Circular.status == status)
    rows = list(await session.scalars(stmt))
    return [await _hydrate_out(session, row) for row in rows]


async def _parent_student(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
) -> Student | None:
    user = await session.scalar(
        select(TenantUser)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            Role.role_key == "parent",
        )
    )
    if user is None:
        return None
    return await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.student_number == user.login_id,
            Student.deleted_at.is_(None),
        )
    )


def _matches_audience(
    circular: Circular,
    *,
    student: Student | None,
    is_parent: bool,
) -> bool:
    if circular.status != CircularStatus.published:
        return False
    if circular.audience == CircularAudience.all_parents:
        return True
    if not is_parent or student is None:
        return circular.audience == CircularAudience.all_parents
    if circular.audience == CircularAudience.class_:
        return circular.class_id is not None and circular.class_id == student.class_id
    if circular.audience == CircularAudience.stream:
        return (
            circular.stream_id is not None
            and circular.stream_id == student.stream_id
            and circular.class_id == student.class_id
        )
    return False


async def list_inbox(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    role: str,
) -> list[CircularOut]:
    rows = list(
        await session.scalars(
            select(Circular)
            .where(
                Circular.tenant_id == tenant_id,
                Circular.deleted_at.is_(None),
                Circular.status == CircularStatus.published,
            )
            .order_by(Circular.published_at.desc())
        )
    )
    is_parent = role == "parent"
    student = await _parent_student(session, tenant_id, user_id) if is_parent else None

    if not is_parent:
        return [await _hydrate_out(session, row) for row in rows]

    filtered = [
        row for row in rows if _matches_audience(row, student=student, is_parent=True)
    ]
    return [await _hydrate_out(session, row) for row in filtered]


async def get_circular(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
) -> CircularOut:
    circular = await _get_circular(session, tenant_id, circular_id)
    return await _hydrate_out(session, circular)


async def create_circular(
    session: AsyncSession,
    tenant_id: UUID,
    body: CircularCreate,
) -> CircularOut:
    audience = CircularAudience(body.audience)
    class_id, stream_id = await _resolve_audience_ids(
        session, tenant_id, audience, body.class_id, body.stream_id
    )
    circular = Circular(
        tenant_id=tenant_id,
        title=body.title.strip(),
        body=body.body.strip(),
        audience=audience,
        priority=CircularPriority(body.priority),
        class_id=class_id,
        stream_id=stream_id,
        status=CircularStatus.draft,
    )
    session.add(circular)
    await session.flush()
    return await _hydrate_out(session, circular)


async def update_circular(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
    body: CircularUpdate,
) -> CircularOut:
    circular = await _get_circular(session, tenant_id, circular_id)

    if body.status is not None:
        new_status = CircularStatus(body.status)
        if circular.status == CircularStatus.published and new_status == CircularStatus.draft:
            raise ValidationError("Published circulars cannot be moved back to draft.")
        circular.status = new_status

    audience = CircularAudience(body.audience) if body.audience is not None else circular.audience
    class_id = body.class_id if body.class_id is not None else circular.class_id
    stream_id = body.stream_id if body.stream_id is not None else circular.stream_id
    if body.audience is not None or body.class_id is not None or body.stream_id is not None:
        class_id, stream_id = await _resolve_audience_ids(
            session, tenant_id, audience, class_id, stream_id
        )
        circular.audience = audience
        circular.class_id = class_id
        circular.stream_id = stream_id

    if body.title is not None:
        circular.title = body.title.strip()
    if body.body is not None:
        circular.body = body.body.strip()
    if body.priority is not None:
        circular.priority = CircularPriority(body.priority)

    return await _hydrate_out(session, circular)


async def publish_circular(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
    publisher_id: UUID,
) -> CircularOut:
    circular = await _get_circular(session, tenant_id, circular_id)
    if circular.status == CircularStatus.archived:
        raise ValidationError("Archived circulars cannot be published.")
    circular.status = CircularStatus.published
    circular.published_at = dt.datetime.now(dt.UTC)
    circular.published_by = publisher_id
    return await _hydrate_out(session, circular)


async def delete_circular(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
) -> None:
    circular = await _get_circular(session, tenant_id, circular_id)
    circular.deleted_at = dt.datetime.now(dt.UTC)
    circular_attachment_service.remove_attachment(tenant_id, circular_id)


async def set_attachment_filename(
    session: AsyncSession,
    tenant_id: UUID,
    circular_id: UUID,
    filename: str | None,
) -> CircularOut:
    circular = await _get_circular(session, tenant_id, circular_id)
    circular.attachment_filename = filename
    return await _hydrate_out(session, circular)
