
from __future__ import annotations
import asyncio, uuid
from celery import Task
from app.workers.celery_app import celery_app
from app.db.session import async_session_factory, engine
from app.repositories.job_repository import JobRepository
from app.models.job import JobStatus
from app.services.ingestion_service import IngestionService
from app.services.summarization_service import SummarizationService
from app.services.fact_check_service import FactCheckService
from app.services.report_service import ReportService
from app.ingestion.scrapers.search_provider import discovery_service
from app.core.llm_client import LiteLLMClient, MockLLMClient
from app.core.config import get_settings
from app.core.logging import get_logger
import os

logger = get_logger("worker")
settings = get_settings()

def run_async(coro):
    return asyncio.run(coro)

class ResumableTask(Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error("task_failed", task_id=task_id, error=str(exc))

@celery_app.task(bind=True, base=ResumableTask, max_retries=3, acks_late=True)
def run_research_pipeline(self, job_id: str, urls: list = None):
    async def _run():
        async with async_session_factory() as db:
            job_repo = JobRepository(db)
            job_uuid = uuid.UUID(job_id)
            job = await job_repo.get(job_uuid)
            if not job:
                return {"error": "job not found"}
            if job.cancel_requested:
                await job_repo.update_status(job_uuid, JobStatus.CANCELLED, stage="cancelled")
                await db.commit()
                return {"cancelled": True}

            # idempotent check
            # resumable: start from current_stage
            stage = job.current_stage
            llm = LiteLLMClient() if os.getenv("USE_MOCK_LLM") != "1" else MockLLMClient()

            try:
                # Stage: SCRAPING
                if stage in ("pending","running"):
                    await job_repo.update_status(job_uuid, JobStatus.SCRAPING, progress=10, stage="scraping", error=None)
                    await db.commit()
                    ingestion = IngestionService(db)
                    # User-supplied URLs take precedence; otherwise discover real sources.
                    target_urls = urls or [
                        result["url"]
                        for result in await discovery_service.discover_urls(job.query)
                        if result.get("url")
                    ]
                    if not target_urls:
                        message = "No research sources were found for this query"
                        await job_repo.update_status(
                            job_uuid, JobStatus.FAILED, error=message, stage="failed"
                        )
                        await db.commit()
                        return {"status": "failed", "job_id": job_id, "error": message}
                    await ingestion.scrape_batch(job_uuid, target_urls)

                db.expire_all()
                if (await job_repo.get(job_uuid)).cancel_requested:
                    await job_repo.update_status(job_uuid, JobStatus.CANCELLED, stage="cancelled")
                    await db.commit()
                    return {"cancelled": True}

                # SUMMARIZING
                await job_repo.update_status(job_uuid, JobStatus.SUMMARIZING, progress=40, stage="summarizing")
                await db.commit()
                summarizer = SummarizationService(db, llm)
                await summarizer.summarize_documents(job_uuid)

                db.expire_all()
                if (await job_repo.get(job_uuid)).cancel_requested:
                    await job_repo.update_status(job_uuid, JobStatus.CANCELLED, stage="cancelled")
                    await db.commit()
                    return {"cancelled": True}

                # FACT_CHECKING
                await job_repo.update_status(job_uuid, JobStatus.FACT_CHECKING, progress=60, stage="fact_checking")
                await db.commit()
                fc = FactCheckService(db, llm)
                await fc.extract_and_verify(job_uuid)

                db.expire_all()
                if (await job_repo.get(job_uuid)).cancel_requested:
                    await job_repo.update_status(job_uuid, JobStatus.CANCELLED, stage="cancelled")
                    await db.commit()
                    return {"cancelled": True}

                # WRITING + EDITING + REPORT
                await job_repo.update_status(job_uuid, JobStatus.WRITING, progress=80, stage="writing")
                await db.commit()
                await job_repo.update_status(job_uuid, JobStatus.EDITING, progress=90, stage="editing")
                await db.commit()

                report_svc = ReportService(db)
                await report_svc.generate(job_uuid)

                await job_repo.update_status(job_uuid, JobStatus.COMPLETED, progress=100, stage="completed")
                await db.commit()
                return {"status": "completed", "job_id": job_id}

            except Exception as e:
                logger.error("pipeline_failed", job_id=job_id, error=str(e))
                await job_repo.update_status(job_uuid, JobStatus.FAILED, error=str(e)[:2000], stage="failed")
                await db.commit()
                raise self.retry(exc=e, countdown=5) if self.request.retries < 2 else e
            finally:
                # Celery runs each task in a new event loop; drop pooled
                # asyncpg connections so they are not reused across loops.
                await engine.dispose()

    return run_async(_run())
