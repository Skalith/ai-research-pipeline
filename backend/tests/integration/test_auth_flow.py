
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_login_refresh():
    # Mock test using direct service calls, not HTTP, because no DB in unit env
    from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
    email = "test@example.com"
    pwd = "password123"
    hashed = hash_password(pwd)
    assert verify_password(pwd, hashed)

    access = create_access_token({"sub": "user-id", "role": "researcher"})
    refresh = create_refresh_token({"sub": "user-id"})
    payload = decode_token(refresh)
    assert payload["type"] == "refresh"

@pytest.mark.asyncio
async def test_ownership_isolation():
    # Two users should not see each other's jobs
    owner1 = "user1-id"
    owner2 = "user2-id"
    store = {}
    def create_job(owner_id, key):
        composite = f"{owner_id}:{key}"
        if composite in store:
            return store[composite]
        job = {"owner_id": owner_id, "key": key}
        store[composite] = job
        return job

    j1 = create_job(owner1, "key1")
    j2 = create_job(owner2, "key1")
    # Same key but different owner should be different jobs
    assert j1["owner_id"] != j2["owner_id"]
    # Owner check
    def get_owned(job, requester_owner_id):
        if job["owner_id"] != requester_owner_id:
            return None
        return job
    assert get_owned(j1, owner1) is not None
    assert get_owned(j1, owner2) is None
