
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    title: str
    markdown: str
    executive_summary: Optional[str] = None
    pdf_path: Optional[str] = None
    docx_path: Optional[str] = None
    created_at: datetime
