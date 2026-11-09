
from __future__ import annotations
import arxiv
from typing import List, Dict

def search_arxiv(query: str, max_results: int = 5, categories: List[str] = None) -> List[Dict]:
    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results = []
    try:
        for r in client.results(search):
            if categories and not any(cat in r.categories for cat in categories):
                continue
            results.append({
                "title": r.title,
                "url": r.pdf_url,
                "summary": r.summary,
                "authors": [a.name for a in r.authors],
                "published": r.published.isoformat() if r.published else None,
                "categories": r.categories,
            })
    except Exception as e:
        return [{"error": str(e)}]
    return results
