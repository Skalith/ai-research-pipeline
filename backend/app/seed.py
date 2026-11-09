"""Create a small, repeatable demo workspace for local development."""
from __future__ import annotations

import uuid

from sqlalchemy import select, text
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import async_session_factory
from app.models.claim import Claim, ClaimVerdict
from app.models.document import Document
from app.models.job import JobStatus, ResearchJob
from app.models.report import Report
from app.models.source import Source
from app.models.user import User, UserRole

DEMO_JOB_ID = uuid.UUID("3992ca16-2623-4b77-a6b0-9aed31f00636")
DEMO_SOURCE_IDS = (
    uuid.UUID("d2bf8f8f-5221-42c0-82b8-df0ba95d5f0d"),
    uuid.UUID("f8879c76-359f-49b5-a8fd-6acb34888b2e"),
)
DEMO_DOCUMENT_IDS = (
    uuid.UUID("72cbe606-9c1f-4e41-98c7-9de291509784"),
    uuid.UUID("6c47071c-c1fd-4c93-9a0f-408c41e9198e"),
)


async def seed_demo_data() -> None:
    settings = get_settings()
    if not settings.demo_seed_enabled or settings.environment.lower() in {"prod", "production"}:
        return

    async with async_session_factory() as db:
        # Avoid duplicate inserts when multiple API workers start together.
        async with db.begin():
            await db.execute(text("SELECT pg_advisory_xact_lock(731942615)"))
            async def get_or_create_user(email: str, password: str, role: UserRole) -> User:
                user = await db.scalar(select(User).where(User.email == email.lower()))
                if user is None:
                    user = User(
                        email=email.lower(),
                        hashed_password=hash_password(password),
                        role=role,
                        is_active=True,
                    )
                    db.add(user)
                    await db.flush()
                return user

            user = await get_or_create_user(settings.demo_email, settings.demo_password, UserRole.RESEARCHER)
            await get_or_create_user(settings.demo_admin_email, settings.demo_admin_password, UserRole.ADMIN)
            await get_or_create_user(settings.demo_viewer_email, settings.demo_viewer_password, UserRole.VIEWER)

            job = await db.get(ResearchJob, DEMO_JOB_ID)
            if job is None:
                job = ResearchJob(
                    id=DEMO_JOB_ID,
                    query="How do urban green spaces affect public health?",
                    status=JobStatus.COMPLETED,
                    current_stage="completed",
                    progress=100,
                    idempotency_key="demo-seed-urban-green-spaces-v1",
                    owner_id=user.id,
                    result_summary="Illustrative demo report with sample sources and claims.",
                    meta_data={"demo": True},
                )
                db.add(job)
                await db.flush()

            sources = [
                Source(
                    id=DEMO_SOURCE_IDS[0], job_id=job.id,
                    url="https://example.org/demo/urban-green-spaces-review",
                    url_hash="demo-urban-green-spaces-review-v1",
                    title="Urban green spaces and public health (illustrative source)",
                    status="completed", word_count=820,
                    metadata_json={"demo": True, "note": "Illustrative sample; not a real publication."},
                ),
                Source(
                    id=DEMO_SOURCE_IDS[1], job_id=job.id,
                    url="https://example.org/demo/parks-and-wellbeing",
                    url_hash="demo-parks-and-wellbeing-v1",
                    title="Parks, activity, and wellbeing (illustrative source)",
                    status="completed", word_count=640,
                    metadata_json={"demo": True, "note": "Illustrative sample; not a real publication."},
                ),
            ]
            for source in sources:
                if await db.get(Source, source.id) is None:
                    db.add(source)
            await db.flush()

            documents = [
                Document(
                    id=DEMO_DOCUMENT_IDS[0], job_id=job.id, source_id=DEMO_SOURCE_IDS[0],
                    raw_content="Illustrative demo content. This is generated sample data, not a real source.",
                    cleaned_content="Sample review: access to nearby green space may support physical activity and wellbeing. This example is illustrative only.",
                    summary="An illustrative review summary about access, activity, and wellbeing.", token_count=24,
                ),
                Document(
                    id=DEMO_DOCUMENT_IDS[1], job_id=job.id, source_id=DEMO_SOURCE_IDS[1],
                    raw_content="Illustrative demo content. This is generated sample data, not a real source.",
                    cleaned_content="Sample discussion: park quality, safety, and equitable access can shape how communities use green spaces. This example is illustrative only.",
                    summary="An illustrative summary about park quality and equitable access.", token_count=25,
                ),
            ]
            for document in documents:
                if await db.get(Document, document.id) is None:
                    db.add(document)
            await db.flush()

            if await db.scalar(select(Report).where(Report.job_id == job.id)) is None:
                db.add(Report(
                    job_id=job.id,
                    title="Urban Green Spaces and Public Health",
                    executive_summary=("Illustrative demo only: green spaces may support activity and wellbeing; "
                                       "access, quality, and safety influence who benefits."),
                    markdown=("# Urban Green Spaces and Public Health\n\n"
                              "> Demo data: the sources and findings below are illustrative and are not real research.\n\n"
                              "## Summary\nNearby green spaces may support physical activity and wellbeing. "
                              "Access, park quality, and safety can affect community use.\n\n"
                              "## Evidence\n- Sample claim: nearby green space may support physical activity.\n"
                              "- Sample claim: equitable access and park quality can affect use.\n\n"
                              "## Sources\n- [Illustrative source 1](https://example.org/demo/urban-green-spaces-review)\n"
                              "- [Illustrative source 2](https://example.org/demo/parks-and-wellbeing)\n"),
                    metadata_json={"demo": True},
                ))

            claim_specs = [
                ("Nearby green spaces may support physical activity.", DEMO_SOURCE_IDS[0], DEMO_DOCUMENT_IDS[0], "Sample review: access to nearby green space may support physical activity and wellbeing.", 0.82),
                ("Equitable access and park quality can affect community use.", DEMO_SOURCE_IDS[1], DEMO_DOCUMENT_IDS[1], "Sample discussion: park quality, safety, and equitable access can shape how communities use green spaces.", 0.78),
            ]
            existing_claims = set((await db.scalars(select(Claim.claim_text).where(Claim.job_id == job.id))).all())
            for claim_text, source_id, document_id, quote, confidence in claim_specs:
                if claim_text not in existing_claims:
                    db.add(Claim(
                        job_id=job.id, source_id=source_id, document_id=document_id,
                        claim_text=claim_text, source_url=(
                            "https://example.org/demo/urban-green-spaces-review"
                            if source_id == DEMO_SOURCE_IDS[0]
                            else "https://example.org/demo/parks-and-wellbeing"
                        ), quote=quote, confidence=confidence,
                        verdict=ClaimVerdict.UNVERIFIED,
                        reason="Illustrative demo claim; no real source verification was performed.",
                    ))
