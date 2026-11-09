from __future__ import annotations
import enum, uuid
from typing import Optional
from sqlalchemy import String, Text, Enum, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base, TimestampMixin

class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SCRAPING = "scraping"
    SUMMARIZING = "summarizing"
    FACT_CHECKING = "fact_checking"
    WRITING = "writing"
    EDITING = "editing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ResearchJob(Base, TimestampMixin):
    __tablename__ = "research_jobs"
    query: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        default=JobStatus.PENDING,
        nullable=False,
    )
    current_stage: Mapped[str] = mapped_column(String(50), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta_data: Mapped[dict] = mapped_column("meta", JSON, default=dict)
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    result_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
