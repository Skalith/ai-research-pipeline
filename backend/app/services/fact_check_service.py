
from __future__ import annotations
from uuid import UUID
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.document_repository import DocumentRepository
from app.repositories.claim_repository import ClaimRepository
from app.repositories.source_repository import SourceRepository
from app.models.claim import Claim, ClaimVerdict
from app.core.llm_client import LLMClient, LLMMessage
from app.core.logging import get_logger
from app.core.security import sanitize_scraped_content_for_llm, verify_quote_in_source

logger = get_logger("factcheck")

class FactCheckService:
    def __init__(self, db: AsyncSession, llm: LLMClient):
        self.db = db
        self.llm = llm
        self.doc_repo = DocumentRepository(db)
        self.claim_repo = ClaimRepository(db)
        self.source_repo = SourceRepository(db)

    async def extract_and_verify(self, job_id: UUID) -> List[dict]:
        docs = await self.doc_repo.list_by_job(job_id)
        all_claims = []
        for doc in docs:
            source = await self.source_repo.get_by_id(doc.source_id) if doc.source_id else None
            source_url = source.url if source and source.status == "scraped" else ""
            msgs = [
                LLMMessage(role="system", content="You extract factual claims. For each claim, provide claim_text, quote (an exact quote from context), confidence 0-1, verdict (verified/disputed/unverified), and reason. Do not invent or choose a source URL. Output JSON {claims: [...]}."),
                LLMMessage(role="user", content=f"Document URL: {source_url or 'unavailable'}\nDocument content:\n{sanitize_scraped_content_for_llm(doc.cleaned_content[:5000])}\nExtract claims supported by this document. If no exact supporting quote exists, use an empty quote and mark the claim unverified.")
            ]
            try:
                data = await self.llm.complete_json(msgs, trace_name="fact-checker")
                claims_raw = data.get("claims", [])
                for c in claims_raw:
                    if not isinstance(c, dict):
                        continue
                    verdict_str = str(c.get("verdict", "unverified")).lower()
                    quote = str(c.get("quote", "")).strip()[:2000]
                    confidence = _confidence(c.get("confidence", 0.1))
                    quote_supported = bool(source_url and quote and verify_quote_in_source(quote, doc.cleaned_content))
                    if not quote_supported:
                        verdict = ClaimVerdict.UNVERIFIED
                        confidence = min(confidence, 0.3)
                    else:
                        verdict = ClaimVerdict.VERIFIED if verdict_str=="verified" else ClaimVerdict.DISPUTED if verdict_str=="disputed" else ClaimVerdict.UNVERIFIED
                    claim_text = str(c.get("claim_text", "")).strip()[:2000]
                    if not claim_text:
                        continue
                    claim = Claim(
                        job_id=job_id,
                        source_id=doc.source_id,
                        document_id=doc.id,
                        claim_text=claim_text,
                        source_url=source_url,
                        quote=quote,
                        confidence=confidence,
                        verdict=verdict,
                        reason=str(c.get("reason", ""))[:1000]
                    )
                    all_claims.append(claim)
            except Exception as e:
                logger.error("fact_check_failed", doc_id=str(doc.id), error=str(e))
                continue

        # Enforce rule: no source = unverified (defense in depth)
        for cl in all_claims:
            if not cl.source_url:
                cl.verdict = ClaimVerdict.UNVERIFIED
                if cl.confidence > 0.4:
                    cl.confidence = 0.2

        if all_claims:
            await self.claim_repo.bulk_create(all_claims)
            await self.db.commit()

        return [{"claim_text": c.claim_text, "verdict": c.verdict.value, "confidence": c.confidence, "source_url": c.source_url} for c in all_claims]


def _confidence(value) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.1
