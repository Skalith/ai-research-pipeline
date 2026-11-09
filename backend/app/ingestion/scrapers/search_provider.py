
from __future__ import annotations
from typing import List, Dict, Optional
import os, re
import httpx
from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("search_provider")

class SearchProvider:
    async def search(self, query: str, max_results: int = 10) -> List[Dict[str,str]]:
        raise NotImplementedError

class TavilyProvider(SearchProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("TAVILY_API_KEY") or settings.tavily_api_key
    async def search(self, query: str, max_results: int = 10) -> List[Dict]:
        if not self.api_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post("https://api.tavily.com/search", json={"api_key": self.api_key, "query": query, "max_results": max_results, "search_depth": "advanced"})
                resp.raise_for_status()
                data = resp.json()
                results = []
                for r in data.get("results", []):
                    results.append({"title": r.get("title",""), "url": r.get("url",""), "snippet": r.get("content","")[:500], "provider": "tavily"})
                return results
        except Exception as e:
            logger.warning("tavily_failed", error=str(e))
            return []

class SerpAPIProvider(SearchProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("SERPAPI_API_KEY") or settings.serpapi_api_key
    async def search(self, query: str, max_results: int = 10) -> List[Dict]:
        if not self.api_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get("https://serpapi.com/search.json", params={"engine": "google", "q": query, "num": max_results, "api_key": self.api_key})
                resp.raise_for_status()
                data = resp.json()
                results = []
                for r in data.get("organic_results", [])[:max_results]:
                    results.append({"title": r.get("title",""), "url": r.get("link",""), "snippet": r.get("snippet","")[:500], "provider": "serpapi"})
                return results
        except Exception as e:
            logger.warning("serpapi_failed", error=str(e))
            return []

class DuckDuckGoProvider(SearchProvider):
    async def search(self, query: str, max_results: int = 10) -> List[Dict]:
        try:
            # Use DuckDuckGo HTML search - no API key needed
            async with httpx.AsyncClient(timeout=20, headers={"User-Agent": settings.scraper_user_agent}) as client:
                resp = await client.get("https://html.duckduckgo.com/html/", params={"q": query})
                # Parse simple links
                html = resp.text
                import re
                pattern = re.compile(r'<a[^>]+class="result__url"[^>]*href="([^"]+)"')
                matches = pattern.findall(html)
                # Better: find result links
                link_pat = re.compile(r'<a class="result__a" href="([^"]+)"')
                links = link_pat.findall(html)
                results = []
                for url in links[:max_results]:
                    # DuckDuckGo redirects via /l/?uddg=...
                    if "uddg=" in url:
                        import urllib.parse
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
                        real = parsed.get("uddg", [url])[0]
                        url = real
                    results.append({"title": query, "url": url, "snippet": "", "provider": "duckduckgo"})
                return results
        except Exception as e:
            logger.warning("duckduckgo_failed", error=str(e))
            return []

class ArxivSearchProvider(SearchProvider):
    async def search(self, query: str, max_results: int = 5) -> List[Dict]:
        try:
            from app.ingestion.scrapers.arxiv_client import search_arxiv
            import asyncio
            results = await asyncio.to_thread(search_arxiv, query, max_results)
            return [
                {
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "snippet": result.get("summary", "")[:500],
                    "provider": "arxiv",
                }
                for result in results
                if result.get("url")
            ]
        except Exception as e:
            logger.warning("arxiv_search_failed", error=str(e))
            return []

class DiscoveryService:
    def __init__(self):
        self.providers: List[SearchProvider] = [
            TavilyProvider(),
            SerpAPIProvider(),
            DuckDuckGoProvider(),
            ArxivSearchProvider(),
        ]

    async def discover_urls(self, query: str, max_results: int = 15, include_arxiv: bool = True) -> List[Dict]:
        all_results: List[Dict] = []
        seen_urls = set()
        for provider in self.providers:
            if not include_arxiv and isinstance(provider, ArxivSearchProvider):
                continue
            try:
                res = await provider.search(query, max_results=max_results)
                for r in res:
                    url = r.get("url")
                    if not url or url in seen_urls:
                        continue
                    # Basic URL validation
                    if not url.startswith("http"):
                        continue
                    seen_urls.add(url)
                    all_results.append(r)
                    if len(all_results) >= max_results:
                        break
            except Exception as e:
                logger.warning("discovery_provider_failed", provider=type(provider).__name__, error=str(e))
                continue
            if len(all_results) >= max_results:
                break
        # Dedupe by url
        deduped = []
        seen = set()
        for r in all_results:
            if r["url"] not in seen:
                seen.add(r["url"])
                deduped.append(r)
        return deduped[:max_results]

discovery_service = DiscoveryService()
