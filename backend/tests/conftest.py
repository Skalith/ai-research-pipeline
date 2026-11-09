
import os
os.environ["USE_MOCK_LLM"] = "1"
import pytest

@pytest.fixture
def mock_llm():
    from app.core.llm_client import MockLLMClient
    return MockLLMClient()
