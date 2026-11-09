
from __future__ import annotations
from uuid import UUID
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.source_repository import SourceRepository
from app.repositories.document_repository import DocumentRepository
from app.models.source import Source
from app.models.document import Document
from app.ingestion.scrapers.web_scraper import scrape_url, hash_url, hash_content
from app.core.logging import get_logger

logger = get_logger("ingestion")

class IngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.source_repo = SourceRepository(db)
        self.doc_repo = DocumentRepository(db)

    async def scrape_batch(self, job_id: UUID, urls: List[str]) -> Dict:
        results = {"scraped": [], "failed": [], "duplicates": []}
        for url in urls:
            uhash = hash_url(url)
            existing = await self.source_repo.find_by_url_hash(job_id, uhash)
            if existing:
                results["duplicates"].append({"url": url, "reason": "url_hash duplicate"})
                continue
            try:
                data = await scrape_url(url)
                # content dedupe
                dup = await self.doc_repo.find_duplicate_content(job_id, data["content_hash"])
                if dup:
                    # mark as duplicate but still store source as duplicate
                    src = Source(job_id=job_id, url=url, url_hash=uhash, title=url, status="duplicate", content_hash=data["content_hash"], word_count=data.get("word_count",0), metadata_json={"paywall": data.get("paywall", False)})
                    await self.source_repo.create(src)
                    results["duplicates"].append({"url": url, "reason": "content_hash duplicate"})
                    continue

                src = Source(job_id=job_id, url=url, url_hash=uhash, title=url[:500], status="scraped", content_hash=data["content_hash"], word_count=data.get("word_count",0), metadata_json={"paywall": data.get("paywall", False)})
                await self.source_repo.create(src)
                doc = Document(job_id=job_id, source_id=src.id, raw_content=data["raw_html"][:20000], cleaned_content=data["cleaned"], token_count=len(data["cleaned"].split()))
                await self.doc_repo.create(doc)
                results["scraped"].append({"url": url, "doc_id": str(doc.id)})
            except Exception as e:
                logger.warning("scrape_failed", url=url, error=str(e))
                try:
                    src = Source(job_id=job_id, url=url, url_hash=uhash, status="failed", error=str(e)[:1000])
                    await self.source_repo.create(src)
                except Exception:
                    pass
                results["failed"].append({"url": url, "error": str(e)})
        await self.db.commit()
        return results
