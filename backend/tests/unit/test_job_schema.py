import pytest
from pydantic import ValidationError

from app.api.v1.schemas.job import JobCreate


def test_job_create_accepts_bounded_http_urls():
    payload = JobCreate(query="A valid research query", urls=["https://example.org/paper"])
    assert payload.urls == ["https://example.org/paper"]


@pytest.mark.parametrize("url", ["file:///etc/passwd", "https:///missing-host", "not a url"])
def test_job_create_rejects_non_http_or_incomplete_urls(url):
    with pytest.raises(ValidationError):
        JobCreate(query="A valid research query", urls=[url])


def test_job_create_limits_number_of_urls():
    with pytest.raises(ValidationError):
        JobCreate(query="A valid research query", urls=[f"https://example.org/{i}" for i in range(51)])
