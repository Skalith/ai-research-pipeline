
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.claim import Claim
from .base import BaseRepository
from uuid import UUID
from typing import List

class ClaimRepository(BaseRepository[Claim]):
    def __init__(self, db: AsyncSession):
        super().__init__(Claim, db)

    async def list_by_job(self, job_id: UUID) -> List[Claim]:
        res = await self.db.execute(select(Claim).where(Claim.job_id == job_id))
        return list(res.scalars().all())

    async def bulk_create(self, claims: List[Claim]):
        self.db.add_all(claims)
        await self.db.flush()
        return claims
