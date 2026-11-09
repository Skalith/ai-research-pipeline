from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.job import ResearchJob
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.repositories.job_repository import JobRepository
from app.repositories.user_repository import UserRepository


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_token(token)
        if payload.get("type") != "access" or not payload.get("sub"):
            raise ValueError("Invalid access token")
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    logout_at = await db.scalar(
        select(AuditLog.created_at)
        .where(AuditLog.user_id == user.id, AuditLog.action == "logout")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    issued_at = payload.get("iat")
    if logout_at and (issued_at is None or float(issued_at) <= logout_at.timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been logged out")
    return user


def require_role(roles: list[UserRole]):
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != UserRole.ADMIN and current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker


async def get_owned_job(job_id: uuid.UUID, db: AsyncSession, user: User) -> ResearchJob:
    job = await JobRepository(db).get(job_id)
    if not job or (user.role != UserRole.ADMIN and job.owner_id != user.id):
        # Do not disclose whether another user's job exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


async def get_idempotency_key(
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
) -> str:
    return idempotency_key or str(uuid.uuid4())


async def get_stream_user(
    job_id: uuid.UUID,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate an SSE request by bearer token or a short-lived stream token."""
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") != "stream" or payload.get("job_id") != str(job_id):
                raise ValueError("Invalid stream token")
            user_id = uuid.UUID(payload["user_id"])
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired stream token")
        user = await UserRepository(db).get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
        return user
    return await get_current_user(authorization=authorization, db=db)
