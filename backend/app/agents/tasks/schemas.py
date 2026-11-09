
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional

class ScoutOutput(BaseModel):
    queries: List[str] = Field(default_factory=list)
    urls: List[str] = Field(default_factory=list)

class PaperSummary(BaseModel):
    summary: str
    key_points: List[str] = Field(default_factory=list)

class FactCheckClaim(BaseModel):
    claim_text: str
    source_url: str = ""
    quote: str = ""
    confidence: float = 0.0
    verdict: str = "unverified"
    reason: str = ""

class FactCheckOutput(BaseModel):
    claims: List[FactCheckClaim]

class WriterSection(BaseModel):
    heading: str
    content: str

class WriterOutput(BaseModel):
    title: str
    executive_summary: str
    sections: List[WriterSection]

class EditorOutput(WriterOutput):
    improved: bool = True
