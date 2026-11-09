
import pytest, os

def test_provider_availability():
    from app.core.llm_gateway import Provider
    cfg = {"name": "test", "enabled": True, "base_url": "https://api.test.com", "api_key_env": "TEST_KEY", "models": [{"name": "test-model"}], "priority": 1}
    os.environ["TEST_KEY"] = "fake"
    p = Provider(cfg)
    assert p.is_available() == True
    del os.environ["TEST_KEY"]
    # Without key, not available
    p2 = Provider(cfg)
    assert p2.is_available() == False

def test_gateway_fallback():
    from app.core.llm_gateway import LLMGateway, Provider
    gw = LLMGateway()
    # Simulate no providers -> should raise if not mock
    os.environ["USE_MOCK_LLM"] = "1"
    try:
        avail = gw.get_available_providers()
        # In mock mode, empty list allowed
        assert isinstance(avail, list)
    finally:
        del os.environ["USE_MOCK_LLM"]

def test_cooldown_backoff():
    from app.core.llm_gateway import Provider
    cfg = {"name": "test", "enabled": True, "base_url": "https://api.test.com", "api_key_env": "TEST_KEY2", "models": [], "priority": 1}
    os.environ["TEST_KEY2"] = "fake"
    p = Provider(cfg)
    assert p.failures == 0
    p.record_failure()
    assert p.failures == 1
    assert p.cooldown_until > 0
    p.record_success()
    assert p.failures == 0
    del os.environ["TEST_KEY2"]
