
from __future__ import annotations
import asyncio
from pathlib import Path

async def generate_docx(markdown: str, output_path: str, data: dict):
    def _gen():
        try:
            from docx import Document
            doc = Document()
            doc.add_heading(data.get("title","Report"), 1)
            doc.add_paragraph(f"Disclaimer: {data.get('disclaimer','AI-assisted, verify sources')}")
            doc.add_paragraph(f"Query: {data.get('query','')}")
            doc.add_heading("Executive Summary",2)
            doc.add_paragraph(data.get("executive_summary",""))
            doc.add_heading("Content",2)
            doc.add_paragraph(markdown[:10000])
            doc.add_heading("Claims",2)
            for c in data.get("claims",[]):
                p = doc.add_paragraph()
                p.add_run(f"{c['claim_text']} ").bold = True
                p.add_run(f"[{c['verdict']} {c['confidence']}] Source: {c['source_url'] or 'unverified'}")
            doc.save(output_path)
        except Exception as e:
            Path(output_path).write_text(markdown, encoding="utf-8")
    await asyncio.to_thread(_gen)
