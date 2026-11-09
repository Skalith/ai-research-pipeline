
from crewai.tools import BaseTool
class SummarizerTool(BaseTool):
    name: str = "Summarize Document"
    description: str = "Summarize a document chunk"
    def _run(self, text: str) -> str:
        return f"Summary of {text[:100]}..."
