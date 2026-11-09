
from __future__ import annotations
import hashlib, asyncio, re
from typing import Dict, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.security import validate_url_for_ssrf, sanitize_scraped_content_for_llm
from app.core.exceptions import SSRFException, ScrapeException
from app.ingestion.parsers.cleaner import html_to_markdown_clean, detect_paywall, is_empty_content

settings = get_settings()

def hash_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()

def hash_content(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()

async def check_robots_txt(url: str) -> bool:
    if not settings.scraper_respect_robots:
        return True
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(robots_url)
        if 400 <= resp.status_code < 500:
            return True
        if resp.status_code >= 500:
            return False
        parser = RobotFileParser(robots_url)
        parser.parse(resp.text.splitlines())
        return parser.can_fetch(settings.scraper_user_agent, url)
    except Exception:
        return True

@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(min=1, max=5),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.TransportError)),
)
async def fetch_with_httpx(url: str) -> str:
    headers = {"User-Agent": settings.scraper_user_agent}
    async with httpx.AsyncClient(timeout=settings.scraper_timeout_seconds, follow_redirects=False, headers=headers) as client:
        current_url = url
        for redirect_count in range(settings.scraper_max_redirects + 1):
            # Validate every hop. Automatic redirect following would let a public
            # page redirect the scraper to a private or metadata address.
            validate_url_for_ssrf(current_url)
            async with client.stream("GET", current_url) as resp:
                if resp.is_redirect:
                    location = resp.headers.get("location")
                    if not location:
                        raise ScrapeException(f"Redirect without a destination for {url}")
                    if redirect_count == settings.scraper_max_redirects:
                        raise ScrapeException(f"Too many redirects for {url}")
                    current_url = urljoin(current_url, location)
                    continue
                resp.raise_for_status()
                content_length = resp.headers.get("content-length")
                if content_length and int(content_length) > settings.scraper_max_content_bytes:
                    raise ScrapeException(f"Page exceeds maximum size for {url}")
                chunks = []
                size = 0
                async for chunk in resp.aiter_bytes():
                    size += len(chunk)
                    if size > settings.scraper_max_content_bytes:
                        raise ScrapeException(f"Page exceeds maximum size for {url}")
                    chunks.append(chunk)
                encoding = resp.encoding or "utf-8"
                return b"".join(chunks).decode(encoding, errors="replace")
        raise ScrapeException(f"Too many redirects for {url}")

async def fetch_with_playwright(url: str) -> str:
    # Lazy import, handle if playwright not installed in test env
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=settings.scraper_user_agent)

                async def guard_request(route):
                    try:
                        validate_url_for_ssrf(route.request.url)
                    except (SSRFException, ValueError):
                        await route.abort()
                    else:
                        await route.continue_()

                await page.route("**/*", guard_request)
                await page.goto(url, wait_until="domcontentloaded", timeout=settings.scraper_timeout_seconds*1000)
                await page.wait_for_timeout(2000)
                content = await page.content()
                if len(content.encode("utf-8")) > settings.scraper_max_content_bytes:
                    raise ScrapeException(f"Page exceeds maximum size for {url}")
                return content
            finally:
                await browser.close()
    except Exception as e:
        raise ScrapeException(f"Playwright failed: {e}")

async def scrape_url(url: str, use_playwright: bool = True) -> Dict:
    # 1. SSRF protection
    validate_url_for_ssrf(url)

    # 2. robots.txt
    allowed = await check_robots_txt(url)
    if not allowed:
        raise ScrapeException(f"Blocked by robots.txt: {url}")

    # 3. Fetch
    raw_html = ""
    try:
        if use_playwright:
            try:
                raw_html = await fetch_with_playwright(url)
            except Exception:
                raw_html = await fetch_with_httpx(url)
        else:
            raw_html = await fetch_with_httpx(url)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status in (403, 401):
            raise ScrapeException(f"Paywall or forbidden {status} for {url}")
        if status == 429:
            raise ScrapeException(f"Rate limited 429 for {url}")
        raise ScrapeException(f"HTTP {status} for {url}")
    except Exception as e:
        raise ScrapeException(f"Fetch failed for {url}: {e}")

    # 4. Clean
    cleaned = html_to_markdown_clean(raw_html)

    # 5. Paywall handling
    if detect_paywall(cleaned):
        # Try to return what we have but flag
        return {
            "url": url,
            "url_hash": hash_url(url),
            "raw_html": raw_html[:5000],
            "cleaned": cleaned,
            "content_hash": hash_content(cleaned),
            "paywall": True,
            "empty": is_empty_content(cleaned),
            "sanitized_for_llm": sanitize_scraped_content_for_llm(cleaned)
        }

    # 6. Empty data handling
    if is_empty_content(cleaned):
        raise ScrapeException(f"Empty content after cleaning for {url}")

    return {
        "url": url,
        "url_hash": hash_url(url),
        "raw_html": raw_html[:20000],
        "cleaned": cleaned,
        "content_hash": hash_content(cleaned),
        "paywall": False,
        "empty": False,
        "sanitized_for_llm": sanitize_scraped_content_for_llm(cleaned),
        "word_count": len(cleaned.split())
    }
