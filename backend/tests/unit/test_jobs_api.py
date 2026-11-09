from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.routers import jobs
from app.models.job import JobStatus


@pytest.mark.asyncio
async def test_cancel_rejects_terminal_job(monkeypatch):
    job = SimpleNamespace(status=JobStatus.COMPLETED, cancel_requested=False)
    monkeypatch.setattr(jobs, "get_owned_job", AsyncMock(return_value=job))
    db = SimpleNamespace(commit=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await jobs.cancel_job(uuid4(), db=db, current_user=SimpleNamespace())

    assert exc.value.status_code == 409
    assert job.cancel_requested is False
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_resume_rejects_non_resumable_job(monkeypatch):
    job = SimpleNamespace(status=JobStatus.RUNNING, cancel_requested=False)
    monkeypatch.setattr(jobs, "get_owned_job", AsyncMock(return_value=job))
    db = SimpleNamespace(commit=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await jobs.resume_job(uuid4(), db=db, current_user=SimpleNamespace())

    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()
