
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.llm_usage import LLMUsage
from .base import BaseRepository
from uuid import UUID
from typing import List

class LLMUsageRepository(BaseRepository[LLMUsage]):
    def __init__(self, db: AsyncSession):
        super().__init__(LLMUsage, db)
    async def get_stats(self):
        # total cost, tokens, by provider
        res = await self.db.execute(select(func.sum(LLMUsage.cost), func.sum(LLMUsage.total_tokens), func.count(LLMUsage.id)))
        total_cost, total_tokens, count = res.one()
        res2 = await self.db.execute(select(LLMUsage.provider, func.sum(LLMUsage.cost), func.sum(LLMUsage.total_tokens), func.count(LLMUsage.id)).group_by(LLMUsage.provider))
        by_provider = [{"provider": r[0], "cost": float(r[1] or 0), "tokens": int(r[2] or 0), "calls": r[3]} for r in res2.all()]
        return {"total_cost": float(total_cost or 0), "total_tokens": int(total_tokens or 0), "total_calls": int(count or 0), "by_provider": by_provider}
    async def list_by_job(self, job_id: UUID) -> List[LLMUsage]:
        res = await self.db.execute(select(LLMUsage).where(LLMUsage.job_id == job_id))
        return list(res.scalars().all())
