
from __future__ import annotations
from jinja2 import Template

def generate_markdown(data: dict) -> str:
    claims_md = "\n".join([f"- **{c['claim_text']}**\n  - Verdict: {c['verdict']} (conf {c['confidence']})\n  - Source: {c['source_url'] or 'No source — unverified'}\n  - Quote: \"{c['quote']}\"\n" for c in data.get("claims",[])])
    documents = data.get("documents", [])
    findings_md = "\n".join(
        f"- {doc.get('summary') or doc.get('title') or doc.get('url') or 'Untitled source'}"
        for doc in documents
    )
    sources_md = "\n".join(
        f"- [{doc.get('title') or doc.get('url') or 'Source'}]({doc['url']})"
        if doc.get("url") else f"- {doc.get('title') or 'Source'}"
        for doc in documents
    )
    return f"""# {data['title']}

> **Disclaimer:** {data['disclaimer']}

**Query:** {data['query']}

## Executive Summary
{data['executive_summary']}

## Findings
{findings_md}

## Claims
{claims_md}

## Sources
{sources_md}

*Generated {data.get('generated_at','')} — AI-assisted, verify sources*
"""
