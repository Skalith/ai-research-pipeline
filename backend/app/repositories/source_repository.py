
from __future__ import annotations
from uuid import UUID
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.source import Source
from .base import BaseRepository

class SourceRepository(BaseRepository[Source]):
    def __init__(self, db: AsyncSession):
        super().__init__(Source, db)

    async def find_by_url_hash(self, job_id: UUID, url_hash: str) -> Optional[Source]:
        res = await self.db.execute(select(Source).where(Source.job_id == job_id, Source.url_hash == url_hash))
        return res.scalar_one_or_none()

    async def get_by_id(self, source_id: UUID) -> Optional[Source]:
        return await self.get(source_id)

    async def list_by_job(self, job_id: UUID):
        res = await self.db.execute(select(Source).where(Source.job_id == job_id))
        return list(res.scalars().all())
