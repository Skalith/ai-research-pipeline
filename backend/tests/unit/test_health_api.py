from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.routers.health import ready


@pytest.mark.asyncio
async def test_ready_checks_database():
    db = AsyncMock()
    assert await ready(db=db) == {"ready": True}
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_ready_returns_503_when_database_is_unavailable():
    db = AsyncMock()
    db.execute.side_effect = RuntimeError("connection refused")

    with pytest.raises(HTTPException) as exc:
        await ready(db=db)

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database is unavailable"
