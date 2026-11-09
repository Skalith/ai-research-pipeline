
import pytest
from app.services.summarization_service import SummarizationService
from app.core.llm_client import MockLLMClient
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_summarizer_with_mock():
    mock_db = AsyncMock()
    # mock repo list_by_job
    doc = MagicMock()
    doc.cleaned_content = "This is a long document about RAG that improves accuracy by 15% with retrieval."
    doc.id = uuid4()
    doc.summary = None

    mock_repo_instance = AsyncMock()
    mock_repo_instance.list_by_job.return_value = [doc]

    svc = SummarizationService(mock_db, MockLLMClient())
    svc.repo = mock_repo_instance
    mock_db.commit = AsyncMock()

    results = await svc.summarize_documents(uuid4())
    assert len(results) == 1
    assert "summary" in results[0]
