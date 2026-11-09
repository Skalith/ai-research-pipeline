
import pytest
from app.services.fact_check_service import FactCheckService
from app.core.llm_client import MockLLMClient
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_fact_checker_enforces_no_source_unverified():
    mock_db = AsyncMock()
    doc = MagicMock()
    doc.cleaned_content = "RAG improves accuracy."
    doc.source_id = uuid4()
    doc.id = uuid4()

    mock_doc_repo = AsyncMock()
    mock_doc_repo.list_by_job.return_value = [doc]
    mock_claim_repo = AsyncMock()
    mock_claim_repo.bulk_create = AsyncMock()

    svc = FactCheckService(mock_db, MockLLMClient())
    svc.doc_repo = mock_doc_repo
    svc.claim_repo = mock_claim_repo
    svc.source_repo.get_by_id = AsyncMock(return_value=None)
    mock_db.commit = AsyncMock()

    results = await svc.extract_and_verify(uuid4())
    # Mock returns 2 claims, one without source_url -> unverified
    assert len(results) >= 1
    unverified = [r for r in results if not r["source_url"]]
    for u in unverified:
        assert u["verdict"] == "unverified"


@pytest.mark.asyncio
async def test_fact_checker_binds_claims_to_document_source_and_checks_quotes():
    mock_db = AsyncMock()
    doc = MagicMock(
        cleaned_content="RAG improves accuracy by 15 percent in our evaluation.",
        source_id=uuid4(),
        id=uuid4(),
    )

    class FixedLLM:
        async def complete_json(self, *_args, **_kwargs):
            return {"claims": [
                {
                    "claim_text": "RAG improved accuracy",
                    "source_url": "https://attacker.example/fake",
                    "quote": "RAG improves accuracy by 15 percent",
                    "confidence": 4,
                    "verdict": "verified",
                },
                {
                    "claim_text": "RAG doubled accuracy",
                    "source_url": "https://attacker.example/fake",
                    "quote": "RAG doubled accuracy by 200 percent",
                    "confidence": 0.95,
                    "verdict": "verified",
                },
            ]}

    svc = FactCheckService(mock_db, FixedLLM())
    svc.doc_repo.list_by_job = AsyncMock(return_value=[doc])
    svc.source_repo.get_by_id = AsyncMock(return_value=MagicMock(
        url="https://publisher.example/paper", status="scraped"
    ))
    svc.claim_repo.bulk_create = AsyncMock()

    results = await svc.extract_and_verify(uuid4())

    assert results[0]["source_url"] == "https://publisher.example/paper"
    assert results[0]["verdict"] == "verified"
    assert results[0]["confidence"] == 1.0
    assert results[1]["source_url"] == "https://publisher.example/paper"
    assert results[1]["verdict"] == "unverified"
    assert results[1]["confidence"] == 0.3
