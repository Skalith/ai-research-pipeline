
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.v1.deps import require_role
from app.api.v1.schemas.job import JobResponse
from app.models.user import UserRole
from app.repositories.llm_usage_repository import LLMUsageRepository
from app.repositories.job_repository import JobRepository
from app.core.config import get_settings
import os, yaml

router = APIRouter()
settings = get_settings()

@router.get("/admin/providers")
async def list_providers(current_user = Depends(require_role([UserRole.ADMIN]))):
    path = settings.providers_config_path
    providers = []
    if os.path.exists(path):
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
            providers = data.get("providers", [])
    # Check if enabled and key present
    for p in providers:
        env_key = p.get("api_key_env")
        p["has_key"] = bool(os.getenv(env_key)) if env_key else False
        p["available"] = p.get("enabled", False) and (p["has_key"] or p["name"]=="ollama")
    return {"providers": providers}

@router.post("/admin/providers/{name}/toggle")
async def toggle_provider(name: str, enabled: bool, current_user = Depends(require_role([UserRole.ADMIN]))):
    path = settings.providers_config_path
    if not os.path.exists(path):
        return {"error": "providers.yaml not found"}
    with open(path, "r") as f:
        data = yaml.safe_load(f) or {}
    for p in data.get("providers", []):
        if p["name"] == name:
            p["enabled"] = enabled
    with open(path, "w") as f:
        yaml.safe_dump(data, f)
    return {"provider": name, "enabled": enabled}

@router.get("/admin/providers/{name}/test")
async def test_provider(name: str, current_user = Depends(require_role([UserRole.ADMIN])), db: AsyncSession = Depends(get_db)):
    # Test connection by listing models or simple call
    import httpx
    path = settings.providers_config_path
    if not os.path.exists(path):
        return {"success": False, "error": "providers.yaml missing"}
    with open(path, "r") as f:
        data = yaml.safe_load(f) or {}
    provider = next((p for p in data.get("providers", []) if p["name"]==name), None)
    if not provider:
        return {"success": False, "error": "provider not found"}
    # Simple test: check if base_url reachable
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(provider["base_url"])
            return {"success": resp.status_code < 500, "status_code": resp.status_code, "provider": name}
    except Exception as e:
        return {"success": False, "error": str(e), "provider": name}

@router.get("/admin/usage")
async def usage_stats(db: AsyncSession = Depends(get_db), current_user = Depends(require_role([UserRole.ADMIN]))):
    repo = LLMUsageRepository(db)
    stats = await repo.get_stats()
    job_repo = JobRepository(db)
    all_jobs = await job_repo.list(limit=1000)
    total_jobs = len(all_jobs)
    by_status = {}
    for j in all_jobs:
        by_status[j.status.value] = by_status.get(j.status.value, 0) + 1
    return {**stats, "jobs_total": total_jobs, "jobs_by_status": by_status}

@router.get("/admin/jobs", response_model=list[JobResponse])
async def admin_jobs(limit: int = Query(default=50, ge=1, le=1000), db: AsyncSession = Depends(get_db), current_user = Depends(require_role([UserRole.ADMIN]))):
    repo = JobRepository(db)
    jobs = await repo.list(limit=limit)
    return jobs
