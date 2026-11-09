
from crewai.tools import BaseTool
class FactCheckTool(BaseTool):
    name: str = "Fact Check Claims"
    description: str = "Extract and verify claims, enforce no source = unverified"
    def _run(self, text: str) -> str:
        return "Fact check output"
