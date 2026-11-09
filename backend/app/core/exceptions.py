from __future__ import annotations

from typing import Any, Dict, Optional


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, details=details)

class ValidationException(AppException):
    def __init__(self, message: str = "Validation error", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, details=details)

class ConflictException(AppException):
    def __init__(self, message: str = "Conflict", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=409, details=details)

class SSRFException(AppException):
    def __init__(self, message: str = "URL blocked by SSRF protection", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)

class ScrapeException(AppException):
    def __init__(self, message: str = "Scraping failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=502, details=details)

class JobCancelledException(AppException):
    def __init__(self, message: str = "Job cancelled", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=499, details=details)
