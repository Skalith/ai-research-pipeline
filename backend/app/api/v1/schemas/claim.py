
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional

class ClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    claim_text: str
    source_url: str
    quote: str
    confidence: float
    verdict: str
    reason: Optional[str] = None
