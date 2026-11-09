
from __future__ import annotations
import uuid
from datetime import datetime
try:
    from sqlalchemy import DateTime, func
    from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
    from sqlalchemy.dialects.postgresql import UUID
    class Base(DeclarativeBase):
        pass
    class TimestampMixin:
        id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
        updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
except ModuleNotFoundError:
    # Fallback for test env without sqlalchemy
    class Base:
        pass
    class TimestampMixin:
        pass
