
from __future__ import annotations
import fitz  # PyMuPDF
from typing import Dict

def parse_pdf_bytes(data: bytes) -> Dict:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        if len(full_text.strip()) < 100:
            return {"text": full_text, "needs_ocr": True, "pages": len(doc), "empty": True}
        return {"text": full_text, "needs_ocr": False, "pages": len(doc), "empty": False}
    except Exception as e:
        return {"text": "", "needs_ocr": False, "pages": 0, "empty": True, "error": str(e)}
