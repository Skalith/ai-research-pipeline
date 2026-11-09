
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report
from .base import BaseRepository
from uuid import UUID
from typing import Optional

class ReportRepository(BaseRepository[Report]):
    def __init__(self, db: AsyncSession):
        super().__init__(Report, db)

    async def get_by_job(self, job_id: UUID) -> Optional[Report]:
        res = await self.db.execute(select(Report).where(Report.job_id == job_id))
        return res.scalar_one_or_none()
