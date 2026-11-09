import asyncio

import pytest

from app.ingestion.scrapers import arxiv_client
from app.ingestion.scrapers.search_provider import ArxivSearchProvider


@pytest.mark.asyncio
async def test_arxiv_provider_runs_sync_client_in_thread(monkeypatch):
    monkeypatch.setattr(
        arxiv_client,
        "search_arxiv",
        lambda query, max_results=5: [{
            "title": "Paper",
            "url": "https://arxiv.org/pdf/1234.5678",
            "summary": "Research summary",
        }],
    )

    async def run_in_thread(func, *args, **kwargs):
        # Avoid spinning up a real executor thread in the unit test suite.
        return func(*args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", run_in_thread)

    results = await ArxivSearchProvider().search("research query", max_results=3)

    assert results == [{
        "title": "Paper",
        "url": "https://arxiv.org/pdf/1234.5678",
        "snippet": "Research summary",
        "provider": "arxiv",
    }]
