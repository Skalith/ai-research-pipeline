
import pytest
from app.services.report_service import ReportService
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_report_generation(monkeypatch):
    # Report generation is the orchestration unit; rendering is tested separately.
    monkeypatch.setattr("app.services.report_service.generate_pdf", AsyncMock())
    monkeypatch.setattr("app.services.report_service.generate_docx", AsyncMock())
    mock_db = AsyncMock()
    job = MagicMock()
    job.query = "Test RAG"
    job.result_summary = None
    job.created_at = datetime.now(timezone.utc)
    doc = MagicMock()
    doc.source_id = uuid4()
    doc.summary = "Doc summary"
    doc.cleaned_content = "content"
    claim = MagicMock()
    claim.claim_text = "Claim"
    claim.source_url = "https://example.com"
    claim.quote = "quote"
    claim.confidence = 0.9
    claim.verdict = MagicMock(value="verified")
    claim.reason = "supported"

    mock_job_repo = AsyncMock()
    mock_job_repo.get.return_value = job
    mock_doc_repo = AsyncMock()
    mock_doc_repo.list_by_job.return_value = [doc]
    mock_claim_repo = AsyncMock()
    mock_claim_repo.list_by_job.return_value = [claim]
    mock_report_repo = AsyncMock()
    mock_report_repo.get_by_job.return_value = None
    mock_report_repo.create = AsyncMock()

    svc = ReportService(mock_db)
    svc.job_repo = mock_job_repo
    svc.doc_repo = mock_doc_repo
    svc.claim_repo = mock_claim_repo
    svc.report_repo = mock_report_repo
    source = MagicMock(url="https://example.com/research", title="Research Source")
    svc.source_repo.get_by_id = AsyncMock(return_value=source)
    mock_db.commit = AsyncMock()

    result = await svc.generate(uuid4(), title="Test Report")
    assert "markdown" in result
    assert "https://example.com/research" in result["markdown"]
    assert "Doc summary" in result["markdown"]
    assert "AI-assisted" in result["markdown"] or "verify sources" in result["markdown"].lower()
