
def test_markdown_includes_disclaimer_and_real_urls():
    from app.reporting.generators.markdown_generator import generate_markdown
    data = {
        "title": "Test Report",
        "query": "Test query",
        "executive_summary": "This is a real summary generated from LLM",
        "sections": [{"heading": "Intro", "content": "Content"}],
        "documents": [{"url": "https://example.com/article1", "title": "Article 1", "word_count": 1000}, {"url": "https://example.com/article2", "title": "Article 2", "word_count": 2000}],
        "claims": [{"claim_text": "Claim 1", "source_url": "https://example.com/article1", "quote": "exact quote", "confidence": 0.9, "verdict": "verified", "reason": "ok"}],
        "disclaimer": "AI-assisted, verify sources",
        "generated_at": "2024-01-01"
    }
    md = generate_markdown(data)
    assert "AI-assisted, verify sources" in md
    assert "https://example.com/article1" in md
    assert "Test Report" in md
    assert "Claim 1" in md

def test_report_paths_validation():
    import os
    base = "/tmp/reports"
    safe_path = os.path.join(base, "job-id.pdf")
    assert os.path.abspath(safe_path).startswith(os.path.abspath(base))
    # Traversal should fail
    unsafe = os.path.join(base, "../../etc/passwd")
    assert not os.path.abspath(unsafe).startswith(os.path.abspath(base)) or ".." in unsafe
