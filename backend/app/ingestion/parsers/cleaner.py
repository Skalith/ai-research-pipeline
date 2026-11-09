
from __future__ import annotations
import re
from bs4 import BeautifulSoup

PAYWALL_INDICATORS = ["subscribe to continue", "paywall", "premium content", "sign in to read", "this content is for subscribers"]

def html_to_markdown_clean(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script","style","nav","footer","aside","iframe"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    # collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def detect_paywall(text: str) -> bool:
    lower = text.lower()
    return any(ind in lower for ind in PAYWALL_INDICATORS)

def is_empty_content(text: str) -> bool:
    return len(text.strip()) < 100
