
from celery import Celery
from app.core.config import get_settings
settings = get_settings()
celery_app = Celery(
    "research_pipeline",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)
celery_app.conf.update(
    task_default_queue="research",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=600,
    task_soft_time_limit=540,
    worker_prefetch_multiplier=1,
)
app = celery_app  # canonical alias so `celery -A app.workers.celery_app worker ...` resolves
