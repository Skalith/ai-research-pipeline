
from __future__ import annotations
import os, time, asyncio, random
from typing import List, Dict, Any, Optional
import yaml
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import AppException

logger = get_logger("llm_gateway")
settings = get_settings()

class Provider:
    def __init__(self, cfg: Dict[str, Any]):
        self.name = cfg["name"]
        self.enabled = cfg.get("enabled", True)
        self.base_url = cfg.get("base_url")
        self.api_key_env = cfg.get("api_key_env")
        self.api_key = os.getenv(self.api_key_env) if self.api_key_env else None
        self.models = cfg.get("models", [])
        self.priority = cfg.get("priority", 10)
        self.openai_compatible = cfg.get("openai_compatible", True)
        self.cooldown_until = 0
        self.failures = 0

    def is_available(self) -> bool:
        if not self.enabled:
            return False
        # If api key env specified but not set, not available unless ollama
        if self.api_key_env and not self.api_key and self.name != "ollama":
            return False
        if time.time() < self.cooldown_until:
            return False
        return True

    def record_failure(self):
        self.failures += 1
        backoff = min(60 * (2 ** self.failures), 600) + random.uniform(0, 5)
        self.cooldown_until = time.time() + backoff
        logger.warning("provider_cooldown", provider=self.name, backoff=backoff, failures=self.failures)

    def record_success(self):
        self.failures = 0
        self.cooldown_until = 0

class LLMGateway:
    def __init__(self):
        self.providers: List[Provider] = []
        self.agent_models: Dict[str, str] = {}
        self._load_config()

    def _load_config(self):
        path = settings.providers_config_path
        if not os.path.exists(path):
            # Try alternative path
            alt = os.path.join(os.getcwd(), path)
            if os.path.exists(alt):
                path = alt
            else:
                logger.warning("providers_yaml_missing", path=path)
                return
        try:
            with open(path, "r") as f:
                data = yaml.safe_load(f) or {}
                for p_cfg in data.get("providers", []):
                    self.providers.append(Provider(p_cfg))
                self.providers.sort(key=lambda p: p.priority)
                self.agent_models = data.get("agent_models", {})
        except Exception as e:
            logger.error("providers_yaml_load_failed", error=str(e))

    def get_model_for_agent(self, agent: str) -> str:
        return self.agent_models.get(agent, settings.default_llm_model)

    def get_available_providers(self) -> List[Provider]:
        avail = [p for p in self.providers if p.is_available()]
        if not avail:
            # If no providers configured, fail loudly
            if os.getenv("USE_MOCK_LLM") == "1" or os.getenv("PYTEST_CURRENT_TEST"):
                return []
            raise AppException(f"No LLM providers available. Configure one of {[p.api_key_env for p in self.providers if p.api_key_env]}", status_code=500)
        return avail

    async def call_with_fallback(self, func, *args, **kwargs):
        providers = self.get_available_providers()
        last_exc = None
        for provider in providers:
            try:
                # Call func with provider context
                result = await func(provider, *args, **kwargs)
                provider.record_success()
                return result, provider
            except Exception as e:
                last_exc = e
                # Check if retryable: 429, timeout, 500
                msg = str(e).lower()
                if "429" in msg or "rate limit" in msg or "timeout" in msg or "500" in msg or "502" in msg or "503" in msg:
                    provider.record_failure()
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                    continue
                else:
                    # Non-retryable, try next provider anyway
                    logger.warning("provider_call_failed_try_next", provider=provider.name, error=str(e))
                    continue
        raise last_exc or AppException("All LLM providers failed", status_code=502)

gateway = LLMGateway()
