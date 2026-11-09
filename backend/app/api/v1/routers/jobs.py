
from __future__ import annotations
import uuid, json, asyncio, hashlib
from typing import List
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.db.session import get_db
from app.api.v1.schemas.job import JobCreate, JobResponse
from app.services.research_service import ResearchService
from app.repositories.job_repository import JobRepository
from app.workers.tasks import run_research_pipeline
from app.core.config import get_settings
from app.core.security import create_stream_token
from app.api.v1.deps import get_current_user, get_owned_job, get_stream_user, require_role
from app.models.job import JobStatus
from app.models.user import User, UserRole
from app.core.logging import get_logger

router = APIRouter()
settings = get_settings()
logger = get_logger("jobs_api")

@router.post("/research/jobs", response_model=JobResponse, status_code=202)
async def create_job(payload: JobCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER])), idempotency_key: str = Header(None, alias="Idempotency-Key")):
    supplied_key = idempotency_key or payload.idempotency_key or str(uuid.uuid4())
    # Keep idempotency records isolated per account despite the DB's global unique key.
    key = hashlib.sha256(f"{current_user.id}:{supplied_key}".encode()).hexdigest()
    svc = ResearchService(db)
    job, created = await svc.create_job(payload.query, key, current_user.id)
    if created:
        # enqueue celery
        run_research_pipeline.delay(str(job.id), payload.urls)
    return job

@router.get("/research/jobs", response_model=List[JobResponse])
async def list_jobs(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    repo = JobRepository(db)
    return await repo.list_owned(current_user.id, limit=limit, offset=offset)

@router.get("/research/jobs/{job_id}/stream-token")
async def get_stream_token(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    await get_owned_job(job_id, db, current_user)
    token = create_stream_token(str(job_id), str(current_user.id))
    return {"stream_token": token}

@router.get("/research/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    job = await get_owned_job(job_id, db, current_user)
    return job

@router.get("/research/jobs/{job_id}/progress")
async def job_progress_sse(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_stream_user)):
    await get_owned_job(job_id, db, current_user)
    async def event_generator():
        # Try redis pubsub, fallback to polling DB every 2s
        try:
            for _ in range(300):
                repo = JobRepository(db)
                # Discard the identity-map copy so progress reflects worker commits.
                db.expire_all()
                job = await repo.get(job_id)
                if not job:
                    yield {"event":"error","data": json.dumps({"error":"not found"})}
                    break
                data = {"job_id": str(job.id), "status": job.status.value, "stage": job.current_stage, "progress": job.progress}
                yield {"event":"progress","data": json.dumps(data)}
                if job.status.value in ("completed","failed","cancelled"):
                    break
                await asyncio.sleep(2)
        except Exception:
            logger.exception("job_progress_stream_failed", job_id=str(job_id))
            yield {"event":"error","data": json.dumps({"error":"Progress stream temporarily unavailable"})}

    return EventSourceResponse(event_generator())

@router.post("/research/jobs/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER]))):
    job = await get_owned_job(job_id, db, current_user)
    if job.status.value in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel a {job.status.value} job")
    job.cancel_requested = True
    await db.commit()
    return job

@router.post("/research/jobs/{job_id}/resume", response_model=JobResponse)
async def resume_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER]))):
    job = await get_owned_job(job_id, db, current_user)
    if job.status.value not in ("failed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot resume a {job.status.value} job")
    job.cancel_requested = False
    job.error = None
    job.status = JobStatus.PENDING
    job.current_stage = "pending"
    job.progress = 0
    await db.commit()
    run_research_pipeline.delay(str(job.id))
    return job
