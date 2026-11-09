
import pytest
from app.core.llm_client import MockLLMClient
from app.services.ingestion_service import IngestionService
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_e2e_mock_pipeline():
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    # Mock source repo
    llm = MockLLMClient()
    # Simulate full flow: scrape -> summarize -> fact_check -> report
    # We already tested individual services, e2e ensures no crash when empty data
    from app.services.summarization_service import SummarizationService
    from app.services.fact_check_service import FactCheckService

    doc = MagicMock()
    doc.cleaned_content = "Content about AI"
    doc.id = uuid4()
    doc.source_id = uuid4()
    doc.summary = None

    mock_repo = AsyncMock()
    mock_repo.list_by_job.return_value = []

    svc_sum = SummarizationService(mock_db, llm)
    svc_sum.repo = mock_repo
    res_sum = await svc_sum.summarize_documents(uuid4())
    assert res_sum == []  # empty data handling

    svc_fc = FactCheckService(mock_db, llm)
    svc_fc.doc_repo = mock_repo
    svc_fc.claim_repo = AsyncMock()
    svc_fc.claim_repo.bulk_create = AsyncMock()
    res_fc = await svc_fc.extract_and_verify(uuid4())
    assert res_fc == []
