from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .config import get_settings
from .logging import get_logger

logger = get_logger("llm_client")

class LLMMessage(BaseModel):
    role: str  # system, user, assistant
    content: str

class LLMResponse(BaseModel):
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost: float = 0.0
    latency_ms: int = 0
    raw: Dict[str, Any] = Field(default_factory=dict)

class LLMClient(ABC):
    @abstractmethod
    async def complete(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format: Optional[str] = None,
        trace_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        ...

    @abstractmethod
    async def complete_json(
        self,
        messages: List[LLMMessage],
        schema: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        trace_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        ...

class LiteLLMClient(LLMClient):
    def __init__(self):
        self.settings = get_settings()
        self._langfuse = None
        if self.settings.is_langfuse_enabled:
            try:
                from langfuse import Langfuse
                self._langfuse = Langfuse(
                    public_key=self.settings.langfuse_public_key,
                    secret_key=self.settings.langfuse_secret_key,
                    host=self.settings.langfuse_host,
                )
            except Exception as e:
                logger.warning("langfuse_init_failed", error=str(e))

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((Exception,)),
        reraise=True,
    )
    async def _call_litellm(self, **kwargs) -> Any:
        import litellm  # lazy import

        # litellm is sync, run in threadpool via asyncio.to_thread would be better, but for simplicity we call and handle
        # Since this method is async, we use to_thread in complete()
        return await self._to_thread(litellm.completion, **kwargs)

    async def _to_thread(self, func, **kwargs):
        import asyncio
        return await asyncio.to_thread(func, **kwargs)

    async def complete(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format: Optional[str] = None,
        trace_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        settings = self.settings
        primary_model = model or settings.default_llm_model
        models_to_try = [primary_model] + settings.fallback_llm_models

        last_exc = None
        for attempt_model in models_to_try:
            try:
                start = time.time()
                litellm_messages = [{"role": m.role, "content": m.content} for m in messages]
                kwargs: Dict[str, Any] = {
                    "model": attempt_model,
                    "messages": litellm_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if response_format == "json_object":
                    kwargs["response_format"] = {"type": "json_object"}

                import litellm
                resp = await self._to_thread(litellm.completion, **kwargs)

                content = resp.choices[0].message.content or ""
                usage = getattr(resp, "usage", None)
                prompt_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
                completion_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
                total_tokens = getattr(usage, "total_tokens", 0) if usage else 0

                latency = int((time.time() - start) * 1000)

                # Langfuse tracing
                if self._langfuse and trace_name:
                    try:
                        self._langfuse.trace(
                            name=trace_name,
                            metadata=metadata or {},
                            input=litellm_messages,
                            output=content,
                        )
                    except Exception:
                        pass

                return LLMResponse(
                    content=content,
                    model=attempt_model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency,
                    raw={"id": getattr(resp, "id", "")},
                )
            except Exception as e:
                last_exc = e
                logger.warning("llm_model_failed_try_next", model=attempt_model, error=str(e))
                continue

        raise last_exc or RuntimeError("All LLM models failed")

    async def complete_json(
        self,
        messages: List[LLMMessage],
        schema: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        trace_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        # Force json mode
        sys_prompt = LLMMessage(
            role="system",
            content="You must output valid JSON only. No markdown, no explanation outside JSON. If schema is provided, follow it strictly.",
        )
        all_messages = [sys_prompt] + messages
        resp = await self.complete(
            messages=all_messages,
            model=model,
            temperature=temperature,
            max_tokens=3000,
            response_format="json_object",
            trace_name=trace_name,
        )
        content = resp.content.strip()
        # Try to extract JSON if wrapped in markdown
        if content.startswith("```"):
            # strip code fences
            lines = content.split("\n")
            # remove first and last if they are fences
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines)
        try:
            parsed = json.loads(content)
            return parsed
        except json.JSONDecodeError as e:
            logger.error("json_parse_failed", content=content[:500], error=str(e))
            # Try repair via second call
            repair_msg = LLMMessage(
                role="user",
                content=f"Fix this invalid JSON to be valid JSON, keep same structure: {content}",
            )
            resp2 = await self.complete(
                messages=[repair_msg],
                model=model,
                temperature=0,
                response_format="json_object",
                trace_name=f"{trace_name}_repair" if trace_name else None,
            )
            return json.loads(resp2.content)


class MockLLMClient(LLMClient):
    """
    Deterministic mock for tests. Returns canned responses based on trace_name or last message content.
    """

    def __init__(self, default_response: str = "Mock response"):
        self.default_response = default_response
        self.calls: List[Dict[str, Any]] = []

    async def complete(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format: Optional[str] = None,
        trace_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        self.calls.append(
            {"messages": [m.model_dump() for m in messages], "trace_name": trace_name, "model": model}
        )
        # Route by trace_name
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        content = self._route_mock(trace_name or "", last_user)
        return LLMResponse(content=content, model=model or "mock-model", latency_ms=10)

    async def complete_json(
        self,
        messages: List[LLMMessage],
        schema: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        trace_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        resp = await self.complete(messages, model=model, temperature=temperature, trace_name=trace_name)
        try:
            return json.loads(resp.content)
        except:
            # fallback if mock returned not json, return structured based on trace
            if "fact" in (trace_name or "").lower():
                return {
                    "claims": [
                        {
                            "claim_text": "Example claim extracted",
                            "source_url": "https://example.com",
                            "quote": "Example quote from source",
                            "confidence": 0.85,
                            "verdict": "verified",
                        }
                    ]
                }
            if "summar" in (trace_name or "").lower():
                return {"summary": "This is a mock summary of the content.", "key_points": ["point 1", "point 2"]}
            return {"mock": True, "content": resp.content}

    def _route_mock(self, trace_name: str, last_user: str) -> str:
        tn = trace_name.lower()
        lu = last_user.lower()

        if "scraper" in tn or "scout" in tn:
            return json.dumps(
                {
                    "queries": ["test query expansion 1", "test query expansion 2"],
                    "urls": ["https://example.com/article1", "https://example.com/article2"],
                }
            )
        if "summarizer" in tn or "summar" in tn:
            return json.dumps(
                {
                    "summary": "Mock summary: The article discusses recent advances.",
                    "key_points": ["Advancement in RAG", "Improved retrieval", "Evaluation metrics"],
                    "entities": ["RAG", "LLM"],
                }
            )
        if "fact-check" in tn or "fact_checker" in tn or "fact" in tn:
            return json.dumps(
                {
                    "claims": [
                        {
                            "claim_text": "RAG improves LLM accuracy by 15%",
                            "source_url": "https://example.com/article1",
                            "quote": "Our experiments show RAG improves accuracy by 15%",
                            "confidence": 0.9,
                            "verdict": "verified",
                            "reason": "Supported by source",
                        },
                        {
                            "claim_text": "Unsubstantiated claim without source",
                            "source_url": "",
                            "quote": "",
                            "confidence": 0.1,
                            "verdict": "unverified",
                            "reason": "No source",
                        },
                    ]
                }
            )
        if "writer" in tn:
            return json.dumps(
                {
                    "title": "Research Report on Test Topic",
                    "executive_summary": "This is a mock executive summary.",
                    "sections": [
                        {"heading": "Introduction", "content": "Intro content"},
                        {"heading": "Findings", "content": "Findings content"},
                    ],
                    "claims": [],
                }
            )
        if "editor" in tn:
            return json.dumps(
                {
                    "title": "Edited: Research Report on Test Topic",
                    "executive_summary": "Edited executive summary with citations.",
                    "sections": [
                        {"heading": "Introduction", "content": "Edited intro"},
                        {"heading": "Findings", "content": "Edited findings with [1]"},
                    ],
                    "improved": True,
                }
            )
        # generic
        return self.default_response
