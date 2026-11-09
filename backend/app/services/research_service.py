
from __future__ import annotations
from uuid import UUID
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.job_repository import JobRepository
from app.models.job import ResearchJob, JobStatus

class ResearchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = JobRepository(db)

    async def create_job(self, query: str, idempotency_key: str, owner_id: UUID = None):
        existing = await self.repo.get_by_idempotency(idempotency_key)
        if existing:
            return existing, False
        job = ResearchJob(query=query, idempotency_key=idempotency_key, owner_id=owner_id, status=JobStatus.PENDING, current_stage="pending", progress=0)
        await self.repo.create(job)
        await self.db.commit()
        return job, True

    async def get_job(self, job_id: UUID):
        return await self.repo.get(job_id)
