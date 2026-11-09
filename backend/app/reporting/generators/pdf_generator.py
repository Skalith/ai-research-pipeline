
from __future__ import annotations
import asyncio
from jinja2 import Environment, FileSystemLoader
import pathlib

async def generate_pdf(markdown: str, output_path: str, data: dict):
    def _gen():
        env = Environment(loader=FileSystemLoader(str(pathlib.Path(__file__).parent.parent / "templates")))
        template = env.get_template("base.html")
        html = template.render(**data, sections=[{"heading":"Content","content":markdown}])
        try:
            from weasyprint import HTML
            HTML(string=html).write_pdf(output_path)
        except Exception as e:
            # Fallback: write html as pdf placeholder
            pathlib.Path(output_path).write_text(html, encoding="utf-8")
    await asyncio.to_thread(_gen)
