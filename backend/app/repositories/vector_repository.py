
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import Document
from uuid import UUID

class VectorRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def similarity_search(self, job_id: UUID, embedding: list, limit: int = 5, threshold: float = 0.8):
        # cosine similarity: 1 - cosine distance; pgvector uses <=> for distance
        # Use raw SQL for vector op
        query = text("""
            SELECT id, 1 - (embedding <=> :embedding) as score
            FROM documents
            WHERE job_id = :job_id AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding
            LIMIT :limit
        """)
        res = await self.db.execute(query, {"embedding": str(embedding), "job_id": str(job_id), "limit": limit})
        rows = res.all()
        return [r for r in rows if r.score >= threshold]

    async def find_near_duplicates(self, job_id: UUID, embedding: list, threshold: float = 0.92):
        return await self.similarity_search(job_id, embedding, limit=3, threshold=threshold)
