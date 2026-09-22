"""Structured logging without leaking secrets."""
from __future__ import annotations

import logging
import re
import sys

_configured = False


class SecretRedactingFilter(logging.Filter):
    """Filter that masks sensitive tokens, API keys, and credentials in log records."""

    def __init__(self) -> None:
        super().__init__()
        # Matches FIRMS area URL patterns: /area/csv/<key>/...
        self._firms_url_re = re.compile(r"(/area/csv/)[a-zA-Z0-9_-]+(/)")
        # Matches 32-character hex map keys
        self._hex_key_re = re.compile(r"\b[0-9a-fA-F]{32}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        from app.core.config import get_settings
        s = get_settings()

        msg = record.getMessage()
        # Redact configured active secrets
        for secret in (s.FIRMS_MAP_KEY, s.FIRMS_API_KEY, s.SECRET_KEY, s.OPENAI_API_KEY, s.GEMINI_API_KEY):
            if secret and len(secret) >= 6 and secret in msg:
                msg = msg.replace(secret, "***REDACTED***")

        # Redact regex patterns
        msg = self._firms_url_re.sub(r"\1***REDACTED***\2", msg)

        # Update record
        record.msg = msg
        record.args = ()
        return True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"thermos.{name}")


def setup_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    lvl = getattr(logging, level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))
    handler.addFilter(SecretRedactingFilter())
    root = logging.getLogger("thermos")
    root.setLevel(lvl)
    root.handlers = [handler]
    # quiet noisy libs
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _configured = True

