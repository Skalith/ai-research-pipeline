
from __future__ import annotations
from typing import Generic, TypeVar, List, Optional, Type
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base

Model = TypeVar("Model", bound=Base)

class BaseRepository(Generic[Model]):
    def __init__(self, model: Type[Model], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: UUID) -> Optional[Model]:
        res = await self.db.execute(select(self.model).where(self.model.id == id))
        return res.scalar_one_or_none()

    async def list(self, limit: int = 100, offset: int = 0) -> List[Model]:
        res = await self.db.execute(select(self.model).limit(limit).offset(offset).order_by(self.model.created_at.desc()))
        return list(res.scalars().all())

    async def create(self, obj: Model) -> Model:
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def delete(self, id: UUID) -> bool:
        obj = await self.get(id)
        if not obj:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True
