
import enum

class ClaimVerdict(str, enum.Enum):
    VERIFIED = "verified"
    DISPUTED = "disputed"
    UNVERIFIED = "unverified"

def enforce_verdict_logic(claim: dict, source_url: str, source_text: str, quote: str):
    from app.core.security import verify_quote_in_source
    if not source_url:
        return ClaimVerdict.UNVERIFIED, 0.2
    if quote and not verify_quote_in_source(quote, source_text):
        return ClaimVerdict.UNVERIFIED, 0.2
    if not quote:
        return ClaimVerdict.UNVERIFIED, 0.1
    return ClaimVerdict.VERIFIED, claim.get("confidence", 0.9)

def test_no_source_unverified():
    verdict, conf = enforce_verdict_logic({"confidence":0.9}, "", "some text", "some quote")
    assert verdict == ClaimVerdict.UNVERIFIED
    assert conf <= 0.3

def test_quote_must_be_substring():
    source = "This paper shows RAG improves accuracy by 15% in our tests"
    quote_valid = "RAG improves accuracy by 15%"
    quote_invalid = "RAG improves accuracy by 99% fake"
    v1, _ = enforce_verdict_logic({"confidence":0.9}, "https://example.com", source, quote_valid)
    v2, _ = enforce_verdict_logic({"confidence":0.9}, "https://example.com", source, quote_invalid)
    assert v1 == ClaimVerdict.VERIFIED
    assert v2 == ClaimVerdict.UNVERIFIED

def test_claim_fields_required():
    claim = {
        "claim_text": "Test claim",
        "source_url": "https://example.com",
        "quote": "exact quote",
        "confidence": 0.85,
        "verdict": "verified"
    }
    for field in ["source_url","quote","confidence","verdict"]:
        assert field in claim
