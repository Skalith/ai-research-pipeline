
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import Document
from .base import BaseRepository
from uuid import UUID

class DocumentRepository(BaseRepository[Document]):
    def __init__(self, db: AsyncSession):
        super().__init__(Document, db)

    async def list_by_job(self, job_id: UUID):
        res = await self.db.execute(select(Document).where(Document.job_id == job_id))
        return list(res.scalars().all())

    async def find_duplicate_content(self, job_id: UUID, content_hash: str):
        from app.models.source import Source
        res = await self.db.execute(select(Source).where(Source.job_id == job_id, Source.content_hash == content_hash))
        return res.scalar_one_or_none()
