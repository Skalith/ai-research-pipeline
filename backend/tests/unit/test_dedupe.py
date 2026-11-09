
import hashlib

def hash_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()

def hash_content(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()

def test_url_hash_dedupe():
    url1 = "https://example.com/article"
    url2 = "https://example.com/article"
    url3 = "https://example.com/other"
    assert hash_url(url1) == hash_url(url2)
    assert hash_url(url1) != hash_url(url3)

def test_content_hash_dedupe():
    content1 = "Same content here"
    content2 = "Same content here"
    content3 = "Different content"
    assert hash_content(content1) == hash_content(content2)
    assert hash_content(content1) != hash_content(content3)

def test_idempotency_per_user():
    # Simulate per-user idempotency
    store = {}
    def create_job(owner_id, key, query):
        composite = f"{owner_id}:{key}"
        if composite in store:
            return store[composite], False
        job = {"owner_id": owner_id, "key": key, "query": query}
        store[composite] = job
        return job, True

    j1, created1 = create_job("user1", "key1", "q1")
    j2, created2 = create_job("user1", "key1", "q1")
    j3, created3 = create_job("user2", "key1", "q1")

    assert created1 == True
    assert created2 == False
    assert created3 == True  # Different user, same key allowed
    assert j1 == j2
    assert j1 != j3
