"""Parent circular schemas."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CircularOut(BaseModel):
    id: UUID
    title: str
    body: str
    status: str
    audience: str
    priority: str
    class_id: UUID | None = None
    class_label: str | None = None
    stream_id: UUID | None = None
    stream_label: str | None = None
    published_at: dt.datetime | None = None
    published_by: UUID | None = None
    attachment_filename: str | None = None
    has_attachment: bool = False
    created_at: dt.datetime
    updated_at: dt.datetime


class CircularCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    audience: str = Field(pattern="^(all_parents|class|stream)$")
    priority: str = Field(default="normal", pattern="^(normal|important)$")
    class_id: UUID | None = None
    stream_id: UUID | None = None

    @field_validator("stream_id")
    @classmethod
    def _stream_requires_class(cls, stream_id: UUID | None, info) -> UUID | None:
        audience = info.data.get("audience")
        class_id = info.data.get("class_id")
        if audience == "stream" and (class_id is None or stream_id is None):
            raise ValueError("Stream circulars require both class and stream.")
        if audience == "class" and class_id is None:
            raise ValueError("Class circulars require a class.")
        if audience == "all_parents" and (class_id is not None or stream_id is not None):
            raise ValueError("All-parent circulars cannot target a class or stream.")
        return stream_id


class CircularUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=20000)
    audience: str | None = Field(default=None, pattern="^(all_parents|class|stream)$")
    priority: str | None = Field(default=None, pattern="^(normal|important)$")
    class_id: UUID | None = None
    stream_id: UUID | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
