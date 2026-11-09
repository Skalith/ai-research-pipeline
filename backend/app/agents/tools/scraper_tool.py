
from crewai.tools import BaseTool
from pydantic import Field

class ScrapeTool(BaseTool):
    name: str = "Scrape URLs"
    description: str = "Scrape a list of URLs safely with SSRF protection, returns cleaned content"
    def _run(self, urls: str) -> str:
        # In real run, this tool is wrapped by service; for crew we return placeholder that will be replaced by service
        return f"Scraped {urls} (tool stub - actual scraping done via IngestionService)"
