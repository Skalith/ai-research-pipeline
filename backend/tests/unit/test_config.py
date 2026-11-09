import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_default_cors_origins_include_local_frontend_hosts():
    settings = Settings(_env_file=None)

    assert "http://localhost:3000" in settings.cors_origins
    assert "http://127.0.0.1:3000" in settings.cors_origins


def test_production_rejects_default_secret_key():
    with pytest.raises(ValidationError, match="unique SECRET_KEY"):
        Settings(_env_file=None, environment="production")


def test_production_accepts_configured_secret_key():
    settings = Settings(_env_file=None, environment="production", secret_key="a-unique-secret-key-for-production-123")
    assert settings.secret_key.startswith("a-unique")
