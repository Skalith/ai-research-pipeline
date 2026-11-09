
from __future__ import annotations
import os
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import AppException
from app.api.v1.routers import health, jobs, reports, sources, auth, admin
from app.seed import seed_demo_data

settings = get_settings()
setup_logging()
logger = get_logger("main")

_LLM_KEY_ENVS = (
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "TAVILY_API_KEY",
    "SERPAPI_API_KEY",
    "OLLAMA_HOST",
)


def _auto_start_worker(app: FastAPI) -> None:
    """Start the Celery worker as a background process so `uvicorn app.main:app`
    alone brings up the whole stack (dev convenience). Disable with AUTO_START_WORKER=0."""
    try:
        if os.getenv("AUTO_START_WORKER", "1") == "0":
            return
        if settings.environment.lower() in {"prod", "production"}:
            return
        existing = subprocess.run(
            ["pgrep", "-f", "app.workers.celery_app.celery_app"],
            capture_output=True,
            text=True,
        )
        if existing.returncode == 0:
            logger.info("dev_worker_already_running")
            return
        worker_env = dict(os.environ)
        if not any(worker_env.get(k) for k in _LLM_KEY_ENVS) and not worker_env.get("USE_MOCK_LLM"):
            worker_env["USE_MOCK_LLM"] = "1"
        os.makedirs("/tmp/research-pipeline-dev", exist_ok=True)
        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        log_dir = os.getenv("LOG_DIR", os.path.join(backend_root, "logs"))
        os.makedirs(log_dir, exist_ok=True)
        celery_log = os.path.join(log_dir, "celery.log")
        proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "celery",
                "-A",
                "app.workers.celery_app",
                "worker",
                "-Q",
                "research",
                "--loglevel=info",
                "--concurrency=2",
            ],
            cwd=backend_root,
            env=worker_env,
            stdout=open(celery_log, "ab"),
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
        app.state.dev_worker_proc = proc
        logger.info("dev_worker_started", pid=proc.pid)
    except Exception as exc:  # pragma: no cover - best-effort dev helper
        logger.warning("dev_worker_auto_start_failed", error=str(exc))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            # Swagger/ReDoc load their assets from the CDN; keep them functional.
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://cdn.jsdelivr.net"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
            )
        return response


class RequestSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, max_size: int = 10 * 1024 * 1024):
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl:
            try:
                too_large = int(cl) > self.max_size
            except ValueError:
                too_large = True
            if too_large:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start
        if response.status_code >= 400 or duration > 2:
            logger.info(
                "request_audit",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration=duration,
                ip=request.client.host if request.client else None,
            )
        return response


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            await seed_demo_data()
        except Exception as exc:
            # Demo accounts are useful in development, but an unavailable database
            # should not prevent the API (including /docs) from starting.
            logger.warning("demo_seed_failed", error=str(exc))
        _auto_start_worker(app)
        yield
        proc = getattr(app.state, "dev_worker_proc", None)
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

    if settings.environment.lower() not in {"development", "dev", "test"} and "*" not in settings.allowed_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestSizeMiddleware, max_size=settings.max_upload_mb * 1024 * 1024)
    app.add_middleware(AuditLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, **({"errors": exc.details} if exc.details else {})},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(health.router, prefix=settings.api_v1_prefix, tags=["health"])
    app.include_router(jobs.router, prefix=settings.api_v1_prefix, tags=["jobs"])
    app.include_router(reports.router, prefix=settings.api_v1_prefix, tags=["reports"])
    app.include_router(sources.router, prefix=settings.api_v1_prefix, tags=["sources"])
    app.include_router(auth.router, prefix=settings.api_v1_prefix, tags=["auth"])
    app.include_router(admin.router, prefix=settings.api_v1_prefix, tags=["admin"])

    @app.get("/")
    async def root():
        return {"name": settings.app_name, "disclaimer": "AI-assisted, verify sources"}

    return app

app = create_app()
