from __future__ import annotations
import enum, uuid
from typing import Optional
from sqlalchemy import Text, ForeignKey, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base, TimestampMixin

class ClaimVerdict(str, enum.Enum):
    VERIFIED = "verified"
    DISPUTED = "disputed"
    UNVERIFIED = "unverified"

class Claim(Base, TimestampMixin):
    __tablename__ = "claims"
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("research_jobs.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    quote: Mapped[str] = mapped_column(Text, default="", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[ClaimVerdict] = mapped_column(
        Enum(ClaimVerdict, values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        default=ClaimVerdict.UNVERIFIED,
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
