
from fastapi import APIRouter
router = APIRouter()
@router.get("/sources")
async def list_sources():
    return []
