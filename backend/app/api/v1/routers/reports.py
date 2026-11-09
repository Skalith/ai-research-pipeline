
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.repositories.report_repository import ReportRepository
from app.repositories.claim_repository import ClaimRepository
from app.repositories.source_repository import SourceRepository
from app.api.v1.deps import get_current_user, get_owned_job, require_role
from app.models.user import User, UserRole
import os

router = APIRouter()

@router.get("/reports/{job_id}")
async def get_report(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    await get_owned_job(job_id, db, current_user)
    repo = ReportRepository(db)
    report = await repo.get_by_job(job_id)
    if not report:
        return JSONResponse(status_code=404, content={"detail":"report not found"})
    return report

@router.get("/reports/{job_id}/download")
async def download_report(job_id: uuid.UUID, format: str = "pdf", db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    await get_owned_job(job_id, db, current_user)
    repo = ReportRepository(db)
    report = await repo.get_by_job(job_id)
    if not report:
        return JSONResponse(status_code=404, content={"detail":"not found"})
    path = report.pdf_path if format=="pdf" else report.docx_path if format=="docx" else None
    if format=="markdown":
        return JSONResponse(content={"markdown": report.markdown})
    if not path or not os.path.exists(path):
        return JSONResponse(status_code=404, content={"detail": f"{format} not found"})
    return FileResponse(path, filename=os.path.basename(path))

@router.get("/research/jobs/{job_id}/claims")
async def list_claims(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    await get_owned_job(job_id, db, current_user)
    repo = ClaimRepository(db)
    claims = await repo.list_by_job(job_id)
    return claims

@router.get("/research/jobs/{job_id}/sources")
async def list_sources(job_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role([UserRole.RESEARCHER, UserRole.VIEWER]))):
    await get_owned_job(job_id, db, current_user)
    repo = SourceRepository(db)
    sources = await repo.list_by_job(job_id)
    return sources
