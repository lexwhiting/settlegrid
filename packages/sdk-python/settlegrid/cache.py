"""LRU + TTL cache for SettleGrid key-validation results.

1:1 mirror of the TS SDK's :ts:class:`LRUCache` (``packages/mcp/src/cache.ts``).
Stores both POSITIVE and NEGATIVE results — caching ``valid=False`` lookups is
deliberate so a flood of bad keys doesn't hammer the API.

Implementation note: thin wrapper around :class:`cachetools.TTLCache`. The
TTL is enforced by ``cachetools`` itself; LRU eviction kicks in when the
cache reaches ``max_size``. ``invalidate`` and ``clear`` methods mirror the
TS surface; ``prune`` triggers an explicit expiry sweep.
"""

from __future__ import annotations

import threading
from collections.abc import Hashable
from typing import Generic, TypeVar

from cachetools import TTLCache  # type: ignore[import-untyped]

from ._types import KeyValidationResult

# Default cache parameters mirror the TS SDK exactly:
# 1000 entries, 5-minute TTL.
DEFAULT_MAX_SIZE = 1000
DEFAULT_TTL_SECONDS = 5 * 60

T = TypeVar("T", bound=Hashable)


class LRUCache(Generic[T]):
    """LRU cache with TTL expiration.

    Generic over the cached value type so the same class can serve both
    :class:`KeyValidationResult` and (in the future) other lookup results.
    The default type parameter (used by the SDK) is
    :class:`KeyValidationResult`.

    Thread-safe: ``cachetools.TTLCache`` is not thread-safe by itself, so a
    single :class:`threading.Lock` guards every public operation. The lock
    is held briefly (constant time per operation) and never crosses I/O.

    Hostile pre-checks:

    - Negative TTL / max_size raise :class:`ValueError` at construction.
    - ``get`` returns ``None`` (not raises) for missing or expired entries
      — matches the TS SDK's ``undefined`` return semantics.
    - ``invalidate`` and ``clear`` are idempotent.
    """

    def __init__(
        self,
        max_size: int = DEFAULT_MAX_SIZE,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
    ) -> None:
        if max_size < 1:
            raise ValueError(
                f"LRUCache max_size must be >= 1, got {max_size}"
            )
        if ttl_seconds <= 0:
            raise ValueError(
                f"LRUCache ttl_seconds must be > 0, got {ttl_seconds}"
            )
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._cache: TTLCache[str, T] = TTLCache(
            maxsize=max_size,
            ttl=ttl_seconds,
        )
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        """Return the cached value, or ``None`` if missing or expired."""
        with self._lock:
            try:
                # ``TTLCache.__getitem__`` triggers expiry-on-access for
                # this single key, so an expired entry returns KeyError
                # (no manual now > expiresAt check needed).
                value: T = self._cache[key]
                return value
            except KeyError:
                return None

    def set(self, key: str, value: T) -> None:
        """Cache ``value`` under ``key``. Evicts oldest if at capacity."""
        with self._lock:
            # ``TTLCache`` handles capacity-bound LRU eviction on assignment.
            self._cache[key] = value

    def invalidate(self, key: str) -> None:
        """Remove a single key. Idempotent — missing keys are silently OK."""
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear the entire cache."""
        with self._lock:
            self._cache.clear()

    @property
    def size(self) -> int:
        """Current number of *non-expired* entries (post-expiry sweep)."""
        with self._lock:
            # Trigger expiry of stale entries before reporting the count
            # so ``size`` matches what ``get`` would observe.
            self._cache.expire()
            return len(self._cache)

    def prune(self) -> int:
        """Force-expire stale entries; return the count removed.

        Mirrors :ts:meth:`LRUCache.prune` in the TS SDK. Useful for tests
        and for long-lived processes that want to reclaim memory between
        validation bursts.
        """
        with self._lock:
            # cachetools.TTLCache.__len__ triggers `expire()` internally,
            # which would auto-sweep before our manual sweep and report
            # zero items removed. Read the raw underlying dict instead
            # (``_Cache__data`` is the base ``Cache``'s OrderedDict, which
            # is a dict view that ignores expiry).
            raw = self._cache._Cache__data
            before = len(raw)
            self._cache.expire()
            after = len(raw)
            return before - after


# Type alias used by the SDK client + middleware so the cache type is
# unambiguous at the call site.
KeyValidationCache = LRUCache[KeyValidationResult]


__all__ = [
    "DEFAULT_MAX_SIZE",
    "DEFAULT_TTL_SECONDS",
    "KeyValidationCache",
    "LRUCache",
]
