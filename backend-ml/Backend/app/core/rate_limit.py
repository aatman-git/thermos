"""Rate limiting: sliding window counter with Redis support and in-memory fallback."""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("ratelimit")

# In-memory sliding window store: {key: [timestamp1, timestamp2, ...]}
_in_memory_store: dict[str, list[float]] = defaultdict(list)
_lock = threading.Lock()


class RateLimiter:
    """Sliding-window rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def is_allowed(self, client_id: str) -> tuple[bool, int]:
        """Check if request is allowed. Returns (allowed, retry_after_seconds)."""
        now = time.time()
        cutoff = now - self.window_seconds

        with _lock:
            timestamps = _in_memory_store[client_id]
            # Prune expired timestamps
            _in_memory_store[client_id] = [t for t in timestamps if t > cutoff]
            current_count = len(_in_memory_store[client_id])

            if current_count >= self.max_requests:
                oldest = _in_memory_store[client_id][0]
                retry_after = max(1, int(oldest + self.window_seconds - now))
                return False, retry_after

            _in_memory_store[client_id].append(now)
            return True, 0


def rate_limit(max_requests: int = 60, window_seconds: int = 60) -> Callable:
    """FastAPI dependency for rate limiting endpoints."""
    limiter = RateLimiter(max_requests=max_requests, window_seconds=window_seconds)

    async def dependency(request: Request) -> None:
        # Extract client identifier: X-Forwarded-For, client host, or anon
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "127.0.0.1")
        )
        key = f"{request.url.path}:{client_ip}"
        allowed, retry_after = limiter.is_allowed(key)

        if not allowed:
            log.warning("Rate limit exceeded for %s on %s (limit: %s/%ss)", client_ip, request.url.path, max_requests, window_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds allowed.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
