
from __future__ import annotations
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from urllib.parse import urlparse

class JobCreate(BaseModel):
    query: str = Field(..., min_length=3, max_length=1000)
    urls: List[str] = Field(default_factory=list, max_length=50)
    idempotency_key: Optional[str] = Field(default=None, max_length=255)

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, urls: List[str]) -> List[str]:
        for url in urls:
            if len(url) > 2048:
                raise ValueError("URL must be at most 2048 characters")
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                raise ValueError("URLs must be absolute HTTP or HTTPS URLs")
        return urls

class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    query: str
    status: str
    current_stage: str
    progress: int
    created_at: datetime
    error: Optional[str] = None

    @computed_field
    @property
    def stage(self) -> str:
        return self.current_stage

class JobProgress(BaseModel):
    job_id: UUID
    status: str
    stage: str
    progress: int
    message: str = ""
