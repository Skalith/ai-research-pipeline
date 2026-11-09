
from __future__ import annotations
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.job_repository import JobRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.claim_repository import ClaimRepository
from app.repositories.source_repository import SourceRepository
from app.repositories.report_repository import ReportRepository
from app.models.report import Report
from app.reporting.generators.markdown_generator import generate_markdown
from app.reporting.generators.pdf_generator import generate_pdf
from app.reporting.generators.docx_generator import generate_docx
from app.core.config import get_settings
import os

settings = get_settings()

class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.job_repo = JobRepository(db)
        self.doc_repo = DocumentRepository(db)
        self.claim_repo = ClaimRepository(db)
        self.source_repo = SourceRepository(db)
        self.report_repo = ReportRepository(db)

    async def generate(self, job_id: UUID, title: str = None):
        job = await self.job_repo.get(job_id)
        docs = await self.doc_repo.list_by_job(job_id)
        claims = await self.claim_repo.list_by_job(job_id)

        sources_by_id = {}
        for doc in docs:
            if doc.source_id and doc.source_id not in sources_by_id:
                source = await self.source_repo.get_by_id(doc.source_id)
                if source:
                    sources_by_id[doc.source_id] = source

        generated_summary = "\n\n".join(
            doc.summary.strip() for doc in docs if doc.summary and doc.summary.strip()
        )
        executive_summary = job.result_summary or generated_summary or "AI-assisted, verify sources"

        data = {
            "title": title or f"Research Report: {job.query[:80]}",
            "query": job.query,
            "executive_summary": executive_summary,
            "documents": [{
                "url": sources_by_id[d.source_id].url if d.source_id in sources_by_id else "",
                "title": sources_by_id[d.source_id].title or "" if d.source_id in sources_by_id else "",
                "summary": d.summary or d.cleaned_content[:500],
            } for d in docs],
            "claims": [{"claim_text": c.claim_text, "source_url": c.source_url, "quote": c.quote, "confidence": c.confidence, "verdict": c.verdict.value, "reason": c.reason} for c in claims],
            "disclaimer": "AI-assisted, verify sources",
            "generated_at": job.created_at.isoformat() if job.created_at else ""
        }

        markdown = generate_markdown(data)

        os.makedirs(settings.report_output_dir, exist_ok=True)
        pdf_path = os.path.join(settings.report_output_dir, f"{job_id}.pdf")
        docx_path = os.path.join(settings.report_output_dir, f"{job_id}.docx")

        # Generate PDF and DOCX (handle failures gracefully)
        try:
            await generate_pdf(markdown, pdf_path, data)
        except Exception as e:
            pdf_path = None

        try:
            await generate_docx(markdown, docx_path, data)
        except Exception as e:
            docx_path = None

        # Upsert report
        existing = await self.report_repo.get_by_job(job_id)
        if existing:
            existing.title = data["title"]
            existing.markdown = markdown
            existing.executive_summary = data["executive_summary"]
            existing.pdf_path = pdf_path
            existing.docx_path = docx_path
            existing.metadata_json = {"claims_count": len(claims), "docs_count": len(docs)}
        else:
            report = Report(job_id=job_id, title=data["title"], markdown=markdown, executive_summary=data["executive_summary"], pdf_path=pdf_path, docx_path=docx_path, metadata_json={"claims_count": len(claims), "docs_count": len(docs)})
            await self.report_repo.create(report)

        await self.db.commit()
        return {"markdown": markdown, "pdf_path": pdf_path, "docx_path": docx_path, "title": data["title"]}
