
from __future__ import annotations
import os
from functools import lru_cache
from typing import List, Optional, Dict, Any

try:
    import yaml
except:
    yaml = None

try:
    from pydantic import Field, field_validator, model_validator
    from pydantic_settings import BaseSettings, SettingsConfigDict
    class Settings(BaseSettings):
        model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
        app_name: str = "Multi-Agent Research Pipeline"
        environment: str = Field(default="development")
        debug: bool = False
        api_v1_prefix: str = "/api/v1"
        secret_key: str = Field(default="change-me-super-secret-key-32-chars-min-for-jwt")
        jwt_algorithm: str = "HS256"
        access_token_expire_minutes: int = 30
        refresh_token_expire_days: int = 7
        allowed_hosts: List[str] = Field(default_factory=lambda: ["*"])
        cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000","http://127.0.0.1:3000","http://localhost:5173"])
        database_url: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/research_pipeline")
        database_url_sync: Optional[str] = None
        test_database_url: Optional[str] = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/research_test")
        redis_url: str = Field(default="redis://localhost:6379/0")
        celery_broker_url: str = Field(default="redis://localhost:6379/1")
        celery_result_backend: str = Field(default="redis://localhost:6379/2")
        openai_api_key: Optional[str] = None
        anthropic_api_key: Optional[str] = None
        tavily_api_key: Optional[str] = None
        serpapi_api_key: Optional[str] = None
        default_llm_model: str = Field(default="gpt-4o-mini")
        embedding_model: str = Field(default="text-embedding-3-small")
        embedding_dim: int = Field(default=1536)
        fallback_llm_models: List[str] = Field(default_factory=lambda: ["gpt-3.5-turbo","claude-3-haiku-20240307"])
        llm_timeout_seconds: int = 60
        llm_max_retries: int = 3
        scraper_timeout_seconds: int = 30
        scraper_user_agent: str = Field(default="Mozilla/5.0 (compatible; ResearchBot/1.0)")
        scraper_max_concurrency: int = 10
        scraper_block_private_ips: bool = True
        scraper_respect_robots: bool = True
        scraper_max_redirects: int = 3
        scraper_max_content_bytes: int = 2_000_000
        demo_seed_enabled: bool = True
        demo_email: str = "demo@example.com"
        demo_password: str = "DemoResearch123!"
        demo_admin_email: str = "admin@example.com"
        demo_admin_password: str = "DemoAdmin123!"
        demo_viewer_email: str = "viewer@example.com"
        demo_viewer_password: str = "DemoViewer123!"
        langfuse_public_key: Optional[str] = None
        langfuse_secret_key: Optional[str] = None
        langfuse_host: str = Field(default="https://cloud.langfuse.com")
        report_output_dir: str = Field(default="/tmp/reports")
        max_upload_mb: int = 20
        rate_limit_per_minute: int = 60
        providers_config_path: str = Field(default="app/core/providers.yaml")
        stream_token_expire_minutes: int = 5
        @field_validator("secret_key")
        @classmethod
        def validate_secret(cls, v: str) -> str:
            if len(v) < 32:
                raise ValueError("secret_key must be >=32 chars")
            return v
        @model_validator(mode="after")
        def reject_default_production_secret(self):
            if self.environment.lower() in {"prod", "production"}:
                lowered = self.secret_key.lower()
                for prefix in ("change-me", "change_me", "replace-with", "replace_with", "replace-", "your-", "your_", "placeholder"):
                    if lowered.startswith(prefix):
                        raise ValueError("Set a unique SECRET_KEY before running in production")
            return self
        @model_validator(mode="after")
        def derive_sync_database_url(self):
            if not self.database_url_sync:
                from sqlalchemy.engine import make_url
                self.database_url_sync = make_url(self.database_url).set(
                    drivername="postgresql+psycopg2"
                ).render_as_string(hide_password=False)
            return self
        @property
        def is_langfuse_enabled(self) -> bool:
            return bool(self.langfuse_public_key and self.langfuse_secret_key)
        def load_providers(self):
            path = self.providers_config_path
            if not os.path.exists(path):
                return []
            if yaml is None:
                return []
            try:
                with open(path, "r") as f:
                    import yaml as y
                    data = y.safe_load(f) or {}
                    return data.get("providers", [])
            except:
                return []
except Exception as e:
    print(f"Config fallback due to {e}")
    class Settings:
        app_name = "Multi-Agent Research Pipeline"
        environment = "development"
        debug = False
        api_v1_prefix = "/api/v1"
        secret_key = "change-me-super-secret-key-32-chars-min-for-jwt"
        jwt_algorithm = "HS256"
        access_token_expire_minutes = 30
        refresh_token_expire_days = 7
        allowed_hosts = ["*"]
        cors_origins = ["http://localhost:3000","http://127.0.0.1:3000","http://localhost:5173"]
        database_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/research_pipeline"
        database_url_sync = "postgresql+psycopg2://postgres:postgres@localhost:5432/research_pipeline"
        test_database_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/research_test"
        redis_url = "redis://localhost:6379/0"
        celery_broker_url = "redis://localhost:6379/1"
        celery_result_backend = "redis://localhost:6379/2"
        openai_api_key = None
        anthropic_api_key = None
        tavily_api_key = None
        serpapi_api_key = None
        default_llm_model = "gpt-4o-mini"
        embedding_model = "text-embedding-3-small"
        embedding_dim = 1536
        fallback_llm_models = ["gpt-3.5-turbo"]
        llm_timeout_seconds = 60
        llm_max_retries = 3
        scraper_timeout_seconds = 30
        scraper_user_agent = "Mozilla/5.0 (compatible; ResearchBot/1.0)"
        scraper_max_concurrency = 10
        scraper_block_private_ips = True
        scraper_respect_robots = True
        scraper_max_redirects = 3
        scraper_max_content_bytes = 2000000
        demo_seed_enabled = True
        demo_email = "demo@example.com"
        demo_password = "DemoResearch123!"
        demo_admin_email = "admin@example.com"
        demo_admin_password = "DemoAdmin123!"
        demo_viewer_email = "viewer@example.com"
        demo_viewer_password = "DemoViewer123!"
        langfuse_public_key = None
        langfuse_secret_key = None
        langfuse_host = "https://cloud.langfuse.com"
        report_output_dir = "/tmp/reports"
        max_upload_mb = 20
        rate_limit_per_minute = 60
        providers_config_path = "app/core/providers.yaml"
        stream_token_expire_minutes = 5
        is_langfuse_enabled = False
        def load_providers(self):
            return []

@lru_cache
def get_settings() -> Settings:
    return Settings()
