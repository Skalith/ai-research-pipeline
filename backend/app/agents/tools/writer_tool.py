
from __future__ import annotations
from crewai.tools import BaseTool

class WriterTool(BaseTool):
    name: str = "Write Report"
    description: str = "Write structured report from summaries and verified claims, with citations. Input: job_id"

    def __init__(self, db_session_factory=None, llm_client=None):
        super().__init__()
        self.db_session_factory = db_session_factory
        self.llm_client = llm_client

    def _run(self, job_id: str, title: str = None) -> str:
        import asyncio
        async def _async_run():
            from app.db.session import async_session_factory
            from app.services.report_service import ReportService
            factory = self.db_session_factory or async_session_factory
            async with factory() as db:
                svc = ReportService(db)
                import uuid
                result = await svc.generate(uuid.UUID(job_id), title=title)
                return f"Generated report: {result['title']} with {len(result.get('markdown',''))} chars"
        return asyncio.run(_async_run())
