"""SettleGrid SDK client.

Public entry point — :class:`SettleGrid` wires together the HTTP client,
LRU cache, error mapping, and wrap decorator into the surface the spec
example shows::

    from settlegrid import SettleGrid

    sg = SettleGrid(api_key="sg_live_...")

    @sg.wrap(meter="my-tool", price_cents=10)
    def my_tool(query: str) -> str:
        return f"result for {query}"

The class deliberately mirrors the TS SDK's ``settlegrid.init()`` factory:
:meth:`validate_key`, :meth:`meter`, :meth:`wrap`, :meth:`clear_cache`. The
TS SDK is async-only (Promise-returning); the Python SDK exposes both
sync (``meter``) and async (``meter_async``) variants so callers don't
need an event loop for synchronous use.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ._http import (
    DEFAULT_API_URL,
    DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS,
    DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
    DEFAULT_MAX_RETRIES,
    DEFAULT_TIMEOUT_MS,
    HTTPConfig,
    SettleGridHTTPClient,
)
from ._types import KeyValidationResult, MeterResult
from .cache import (
    DEFAULT_MAX_SIZE,
    DEFAULT_TTL_SECONDS,
    KeyValidationCache,
)
from .errors import InvalidKeyError

if TYPE_CHECKING:
    from .wrap import Wrapper


SDK_VERSION = "0.1.0"


class SettleGrid:
    """SettleGrid SDK client.

    Args:
        api_key: The SELLER's SettleGrid API key (e.g. ``sg_live_...``).
            This is the developer's own key, used to identify the seller
            in metering calls. Buyer keys are passed per-call via
            :meth:`validate_key`, :meth:`meter`, or the wrap decorator's
            ``_settlegrid_api_key`` kwarg.
        tool_slug: Tool slug as registered at https://settlegrid.ai/tools.
            Defaults to an empty string for the scaffold; production code
            must pass the real slug to receive accurate billing routing.
        api_url: Base URL of the SettleGrid API. Defaults to
            ``https://settlegrid.ai`` — override for staging / local dev.
        timeout_ms: Per-request timeout. Default 5000ms, max 30000ms.
        max_retries: Number of retries on 5xx (in addition to the initial
            attempt). Default 2 — i.e., up to 3 attempts total.
        cache_max_size: LRU cache capacity for key-validation results.
            Default 1000 (matches TS SDK).
        cache_ttl_seconds: Cache TTL for key-validation results. Default
            300 seconds (5 minutes — matches TS SDK).

    Raises:
        ValueError: If ``api_key`` is empty or whitespace-only, or any
            numeric arg is out of range.

    Example::

        sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-tool")

        # Decorator
        @sg.wrap(meter="search", price_cents=10)
        def search(q: str) -> str:
            return f"results for {q}"

        # Or manual
        sg.validate_key("sg_live_buyer_key")
        sg.meter("sg_live_buyer_key", method="search", cost_cents=10)
    """

    api_key: str
    tool_slug: str

    def __init__(
        self,
        api_key: str,
        *,
        tool_slug: str = "",
        api_url: str = DEFAULT_API_URL,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        max_retries: int = DEFAULT_MAX_RETRIES,
        circuit_breaker_threshold: int = DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
        circuit_breaker_cooldown_ms: int = DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS,
        cache_max_size: int = DEFAULT_MAX_SIZE,
        cache_ttl_seconds: float = DEFAULT_TTL_SECONDS,
    ) -> None:
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError(
                "SettleGrid(api_key=...) requires a non-empty string. "
                "Generate a key at https://settlegrid.ai/keys."
            )
        if not isinstance(tool_slug, str):
            raise TypeError("tool_slug must be a string")

        self.api_key = api_key
        self.tool_slug = tool_slug

        self._http = SettleGridHTTPClient(
            HTTPConfig(
                api_url=api_url.rstrip("/"),
                tool_slug=tool_slug,
                timeout_ms=timeout_ms,
                max_retries=max_retries,
                circuit_breaker_threshold=circuit_breaker_threshold,
                circuit_breaker_cooldown_ms=circuit_breaker_cooldown_ms,
                user_agent=f"settlegrid-python/{SDK_VERSION}",
            )
        )
        self._cache: KeyValidationCache = KeyValidationCache(
            max_size=cache_max_size,
            ttl_seconds=cache_ttl_seconds,
        )

    # ─── lifecycle ───────────────────────────────────────────────────

    async def aclose(self) -> None:
        """Close the underlying async HTTP client. Idempotent."""
        await self._http.aclose()

    def close(self) -> None:
        """Close the underlying sync HTTP client. Idempotent."""
        self._http.close()

    # ─── public API: validate_key ────────────────────────────────────

    def validate_key(self, api_key: str) -> KeyValidationResult:
        """Synchronously validate a buyer's API key.

        Returns the cached result when present; otherwise calls the
        SettleGrid API and caches the result (positive AND negative — bad
        keys also get cached so a flood of typos doesn't hammer the API).
        """
        self._guard_buyer_key(api_key, op="validate_key")
        cached = self._cache.get(api_key)
        if cached is not None:
            return cached
        body = self._http.request_sync(
            "/keys/validate",
            {"apiKey": api_key, "toolSlug": self.tool_slug},
        )
        result = KeyValidationResult.model_validate(body)
        self._cache.set(api_key, result)
        return result

    async def validate_key_async(self, api_key: str) -> KeyValidationResult:
        """Async twin of :meth:`validate_key`."""
        self._guard_buyer_key(api_key, op="validate_key_async")
        cached = self._cache.get(api_key)
        if cached is not None:
            return cached
        body = await self._http.request(
            "/keys/validate",
            {"apiKey": api_key, "toolSlug": self.tool_slug},
        )
        result = KeyValidationResult.model_validate(body)
        self._cache.set(api_key, result)
        return result

    # ─── public API: meter ───────────────────────────────────────────

    def meter(
        self,
        api_key: str,
        *,
        method: str,
        cost_cents: int,
        consumer_id: str,
        tool_id: str,
        key_id: str,
    ) -> MeterResult:
        """Synchronously meter (charge) an invocation.

        The flow mirrors the TS SDK: validate the key (cached), then
        POST to ``/api/sdk/meter`` with the cost + the consumer / tool /
        key UUIDs returned by the prior ``validate_key`` call. The server
        enforces balance + budget caps and returns the typed errors the
        SDK maps to :class:`InsufficientCreditsError` /
        :class:`BudgetExceededError`.

        ``consumer_id`` / ``tool_id`` / ``key_id`` are the three UUIDs
        from :class:`KeyValidationResult` — the meter endpoint's Zod
        schema marks all three as required (see
        ``apps/web/src/app/api/sdk/meter/route.ts``). Earlier versions
        of this client omitted them and every meter call failed 400 in
        production; the wrapper now threads them through from the
        validation step.
        """
        self._guard_meter_args(api_key, method, cost_cents, op="meter")
        body = self._http.request_sync(
            "/meter",
            {
                "toolSlug": self.tool_slug,
                "consumerId": consumer_id,
                "toolId": tool_id,
                "keyId": key_id,
                "method": method,
                "costCents": cost_cents,
            },
        )
        return MeterResult.model_validate(body)

    async def meter_async(
        self,
        api_key: str,
        *,
        method: str,
        cost_cents: int,
        consumer_id: str,
        tool_id: str,
        key_id: str,
    ) -> MeterResult:
        """Async twin of :meth:`meter`."""
        self._guard_meter_args(api_key, method, cost_cents, op="meter_async")
        body = await self._http.request(
            "/meter",
            {
                "toolSlug": self.tool_slug,
                "consumerId": consumer_id,
                "toolId": tool_id,
                "keyId": key_id,
                "method": method,
                "costCents": cost_cents,
            },
        )
        return MeterResult.model_validate(body)

    # ─── public API: wrap ────────────────────────────────────────────

    def wrap(
        self,
        *,
        meter: str,
        price_cents: int,
        api_key: str | None = None,
    ) -> Wrapper:
        """Return a :class:`Wrapper` — both decorator and context manager.

        Args:
            meter: Method / tool slug to charge against. Required.
            price_cents: Cost in cents. Must be a non-negative int.
            api_key: Optional buyer key for the context-manager flow. If
                omitted, the wrapper falls back to the SDK's seller key.

        See :mod:`settlegrid.wrap` for usage examples.
        """
        # Lazy import — avoids a circular import between client.py and wrap.py.
        from .wrap import Wrapper

        return Wrapper(
            sg=self,
            meter=meter,
            price_cents=price_cents,
            api_key=api_key,
        )

    # ─── public API: clear_cache ─────────────────────────────────────

    def clear_cache(self) -> None:
        """Clear the in-memory key-validation cache."""
        self._cache.clear()

    @property
    def cache_size(self) -> int:
        """Current number of non-expired cached entries."""
        return self._cache.size

    # ─── input validation helpers ────────────────────────────────────

    @staticmethod
    def _guard_buyer_key(api_key: str, *, op: str) -> None:
        if not isinstance(api_key, str) or not api_key.strip():
            raise InvalidKeyError(
                f"{op}() requires a non-empty API key string. "
                f"Received: {api_key!r}"
            )

    @classmethod
    def _guard_meter_args(
        cls, api_key: str, method: str, cost_cents: int, *, op: str
    ) -> None:
        cls._guard_buyer_key(api_key, op=op)
        if not isinstance(method, str) or not method.strip():
            raise ValueError(
                f"{op}() requires a non-empty method string. "
                f"Received: {method!r}"
            )
        if isinstance(cost_cents, bool) or not isinstance(cost_cents, int):
            raise TypeError(
                f"{op}() requires `cost_cents` as int. "
                f"Received: {type(cost_cents).__name__}"
            )
        if cost_cents < 0:
            raise ValueError(
                f"{op}() requires `cost_cents` >= 0. Received: {cost_cents}"
            )


__all__ = ["SDK_VERSION", "SettleGrid"]
