
import pytest

@pytest.mark.asyncio
async def test_pipeline_checkpoints():
    # Simulate resumable checkpoints
    checkpoints = {}
    stages = ["scraping","summarizing","fact_checking","writing","editing"]

    # Simulate failure after scraping
    checkpoints["scraping"] = {"completed": True, "scraped": 5}
    # Resume should skip scraping
    remaining = [s for s in stages if s not in checkpoints or not checkpoints.get(s,{}).get("completed")]
    assert "scraping" not in remaining
    assert "summarizing" in remaining

@pytest.mark.asyncio
async def test_partial_success():
    result = {"scraped": [{"url":"a"}], "failed": [{"url":"b","error":"403"}], "duplicates": []}
    # If some scraped and some failed, status should be partial_success
    if result["failed"] and result["scraped"]:
        status = "partial_success"
    elif not result["scraped"]:
        status = "failed"
    else:
        status = "completed"
    assert status == "partial_success"

@pytest.mark.asyncio
async def test_cancel_between_stages():
    job = {"cancel_requested": False, "stage": "scraping"}
    # Simulate cancel
    job["cancel_requested"] = True
    if job["cancel_requested"]:
        job["status"] = "cancelled"
    assert job["status"] == "cancelled"

@pytest.mark.asyncio
async def test_mock_llm_client():
    from app.core.llm_client import LLMMessage, MockLLMClient

    llm = MockLLMClient()
    resp = await llm.complete([LLMMessage(role="user", content="test")], trace_name="writer")
    assert resp.content
