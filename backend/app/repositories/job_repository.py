
from __future__ import annotations
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.job import ResearchJob, JobStatus
from .base import BaseRepository

class JobRepository(BaseRepository[ResearchJob]):
    def __init__(self, db: AsyncSession):
        super().__init__(ResearchJob, db)

    async def list_owned(self, owner_id: UUID, limit: int = 50, offset: int = 0) -> List[ResearchJob]:
        res = await self.db.execute(
            select(ResearchJob)
            .where(ResearchJob.owner_id == owner_id)
            .order_by(ResearchJob.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(res.scalars().all())

    async def get_by_idempotency(self, key: str) -> Optional[ResearchJob]:
        res = await self.db.execute(select(ResearchJob).where(ResearchJob.idempotency_key == key))
        return res.scalar_one_or_none()

    async def update_status(self, job_id: UUID, status: JobStatus, progress: int = None, stage: str = None, error: str = None):
        job = await self.get(job_id)
        if not job:
            return None
        job.status = status
        if progress is not None:
            job.progress = progress
        if stage:
            job.current_stage = stage
        if error:
            job.error = error
        await self.db.flush()
        return job

    async def request_cancel(self, job_id: UUID):
        job = await self.get(job_id)
        if job:
            job.cancel_requested = True
            await self.db.flush()
        return job
