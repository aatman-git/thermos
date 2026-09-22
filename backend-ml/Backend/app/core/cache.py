"""Cache abstraction: Redis with in-memory TTL fallback."""
from __future__ import annotations

import json
import threading
import time
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("cache")

_in_memory_cache: dict[str, tuple[float, str]] = {}
_cache_lock = threading.Lock()


class CacheService:
    """Provides get/set with TTL (in seconds). Thread-safe."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis_client = None
        self._redis_available = False
        self._init_redis()

    def _init_redis(self) -> None:
        try:
            import redis  # type: ignore
            client = redis.Redis.from_url(self.settings.REDIS_URL, decode_responses=True)
            client.ping()
            self._redis_client = client
            self._redis_available = True
            log.info("Connected to Redis cache at %s", self.settings.REDIS_URL)
        except Exception:
            self._redis_available = False
            self._redis_client = None

    def get(self, key: str) -> Any | None:
        if self._redis_available and self._redis_client:
            try:
                val = self._redis_client.get(key)
                if val is not None:
                    return json.loads(val)
            except Exception as e:  # noqa: BLE001
                log.debug("Redis get failed: %s, falling back to in-memory", e)

        # In-memory fallback
        now = time.time()
        with _cache_lock:
            if key in _in_memory_cache:
                expires_at, payload = _in_memory_cache[key]
                if now < expires_at:
                    return json.loads(payload)
                del _in_memory_cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 900) -> None:
        serialized = json.dumps(value)
        if self._redis_available and self._redis_client:
            try:
                self._redis_client.setex(key, ttl_seconds, serialized)
                return
            except Exception as e:  # noqa: BLE001
                log.debug("Redis set failed: %s, using in-memory", e)

        # In-memory fallback
        now = time.time()
        with _cache_lock:
            _in_memory_cache[key] = (now + ttl_seconds, serialized)


_instance: CacheService | None = None


def get_cache() -> CacheService:
    global _instance
    if _instance is None:
        _instance = CacheService()
    return _instance
