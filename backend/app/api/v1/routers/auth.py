from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository

router = APIRouter()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


def _response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        refresh_token=create_refresh_token({"sub": str(user.id)}),
        user={"id": str(user.id), "email": user.email, "role": user.role.value},
    )


async def _audit(db: AsyncSession, user: User, action: str, request: Request) -> None:
    await AuditRepository(db).create(AuditLog(
        user_id=user.id,
        action=action,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    ))


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@router.post("/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    email = payload.email.lower()
    if await repo.get_by_email(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    # Public registration can never assign privileged roles.
    user = User(email=email, hashed_password=hash_password(payload.password), role=UserRole.RESEARCHER)
    await repo.create(user)
    await db.flush()
    await _audit(db, user, "register", request)
    await db.commit()
    return _response(user)


@router.post("/login", response_model=TokenResponse)
@router.post("/auth/login", response_model=TokenResponse)
@router.post("/signin", response_model=TokenResponse)
@router.post("/auth/signin", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await UserRepository(db).get_by_email(payload.email.lower())
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    user.last_login_at = datetime.now(timezone.utc)
    await _audit(db, user, "login", request)
    await db.commit()
    return _response(user)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh" or not data.get("sub"):
            raise ValueError("Invalid refresh token")
        user_id = __import__("uuid").UUID(data["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = await UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    logout_at = await db.scalar(
        select(AuditLog.created_at)
        .where(AuditLog.user_id == user.id, AuditLog.action == "logout")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    if logout_at and float(data.get("iat", 0)) <= logout_at.timestamp():
        raise HTTPException(status_code=401, detail="Refresh token has been logged out")
    return _response(user)


@router.post("/logout")
@router.post("/auth/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # The client should discard both tokens after this authenticated response.
    await _audit(db, current_user, "logout", request)
    await db.commit()
    return {"detail": "logged out"}


@router.get("/auth/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }
