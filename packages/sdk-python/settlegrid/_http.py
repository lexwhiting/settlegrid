"""httpx async client wrapper with retries + circuit breaker.

Mirrors the resilience guarantees of the TS SDK's ``middleware.ts``:

- Configurable timeout (default 5s, max 30s) — exceeded → :class:`TimeoutError`.
- Exponential backoff on 5xx (1s, 2s, 4s) up to ``max_retries``.
- Circuit breaker: after ``circuit_breaker_threshold`` consecutive
  failures, ``can_execute()`` returns ``False`` for ``circuit_breaker_cooldown_ms``
  before allowing requests through again.
- Status-code error mapping — 401/402/403/404/429/5xx are mapped to typed
  :mod:`settlegrid.errors` classes.

Both ``request`` (async) and ``request_sync`` (sync) entry points exist so
the SDK supports asyncio code paths and synchronous decorator usage without
forcing the caller to spawn an event loop.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Any, Final

import httpx
from pydantic import ValidationError

from ._types import APIErrorBody
from .errors import (
    InsufficientCreditsError,
    InvalidKeyError,
    NetworkError,
    RateLimitedError,
    SettleGridError,
    SettleGridUnavailableError,
    TimeoutError,
    ToolDisabledError,
    ToolNotFoundError,
)

# ─── Constants (mirror the TS SDK) ────────────────────────────────────────

DEFAULT_API_URL: Final[str] = "https://settlegrid.ai"
DEFAULT_TIMEOUT_MS: Final[int] = 5_000
MAX_TIMEOUT_MS: Final[int] = 30_000
DEFAULT_MAX_RETRIES: Final[int] = 2
DEFAULT_CIRCUIT_BREAKER_THRESHOLD: Final[int] = 5
DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS: Final[int] = 30_000

# Floor of one attempt — even with max_retries=0 we run the request once.
_MIN_ATTEMPTS: Final[int] = 1


# ─── Circuit breaker ─────────────────────────────────────────────────────


class CircuitBreaker:
    """Simple consecutive-failure circuit breaker.

    Mirrors :ts:class:`CircuitBreaker` in ``packages/mcp/src/circuit-breaker.ts``.
    Thread-safe: a lock guards the state machine.
    """

    def __init__(
        self,
        threshold: int = DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
        cooldown_ms: int = DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS,
    ) -> None:
        if threshold < 1:
            raise ValueError(f"threshold must be >= 1, got {threshold}")
        if cooldown_ms < 0:
            raise ValueError(f"cooldown_ms must be >= 0, got {cooldown_ms}")
        self._threshold = threshold
        self._cooldown_ms = cooldown_ms
        self._failures = 0
        self._opened_at_ms: float | None = None
        self._lock = threading.Lock()

    def can_execute(self) -> bool:
        """``True`` when callers may proceed; ``False`` while open."""
        with self._lock:
            if self._opened_at_ms is None:
                return True
            elapsed_ms = (time.time() * 1000) - self._opened_at_ms
            if elapsed_ms >= self._cooldown_ms:
                # Half-open: reset and allow the next probe through.
                self._opened_at_ms = None
                self._failures = 0
                return True
            return False

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at_ms = None

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self._threshold:
                self._opened_at_ms = time.time() * 1000


# ─── HTTP client config ──────────────────────────────────────────────────


@dataclass(frozen=True)
class HTTPConfig:
    """Configuration for the SettleGrid HTTP client."""

    api_url: str = DEFAULT_API_URL
    tool_slug: str = ""  # required at construction; empty default placeholder
    timeout_ms: int = DEFAULT_TIMEOUT_MS
    max_retries: int = DEFAULT_MAX_RETRIES
    circuit_breaker_threshold: int = DEFAULT_CIRCUIT_BREAKER_THRESHOLD
    circuit_breaker_cooldown_ms: int = DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS
    user_agent: str = "settlegrid-python/0.1.0"


# ─── Internal: status-code error mapping ─────────────────────────────────


# H3 hostile fix — fallback retry-after delay for 429 responses without
# header or body. Matches the TS middleware: 60 seconds is a safe default
# that prevents retry storms when the server doesn't surface a delay.
DEFAULT_RETRY_AFTER_SECONDS: Final[int] = 60


def _resolve_retry_after_seconds(
    response_headers: dict[str, str],
    body: APIErrorBody,
) -> int:
    """Resolve the retry-after delay for a 429 response.

    Precedence (mirrors TS middleware):

    1. ``Retry-After`` HTTP header — RFC 7231 delta-seconds (integer).
    2. ``body.retry_after_seconds`` — SDK-side convention, integer.
    3. ``DEFAULT_RETRY_AFTER_SECONDS`` (60) — prevents retry storms when
       the server fails to surface a delay.

    Non-finite or negative values at any level fall through to the next
    source. This matches the TS SDK's defensive parsing exactly.
    """
    header = response_headers.get("retry-after")
    if header is not None:
        try:
            parsed = int(header)
            if parsed >= 0:
                return parsed
        except (TypeError, ValueError):
            # Header is HTTP-date or malformed — fall through.
            pass

    body_value = body.retry_after_seconds
    if isinstance(body_value, int) and not isinstance(body_value, bool) and body_value >= 0:
        return body_value

    return DEFAULT_RETRY_AFTER_SECONDS


def _map_status_to_error(
    status: int,
    body: APIErrorBody,
    *,
    tool_slug: str,
    response_headers: dict[str, str],
) -> SettleGridError:
    """Map an HTTP status + parsed body to the right typed error.

    Mirrors the switch table in the TS middleware. The body is treated as
    advisory — when fields are missing we fall back to safe defaults.
    Headers are read for the 429 ``Retry-After`` delta-seconds.
    """
    if status == 401:
        # H6 hostile fix — fall back to the default constructor when the
        # server omits an error message; avoids the awkward `args[0]`
        # introspection.
        return InvalidKeyError(body.error) if body.error else InvalidKeyError()
    if status == 402:
        # Server-provided ``top_up_url`` may be null / non-string in
        # malformed responses — the error class handles coalescing.
        return InsufficientCreditsError(
            body.required_cents or 0,
            body.available_cents or 0,
            body.top_up_url,
        )
    if status == 403:
        if body.code == "TOOL_DISABLED":
            return ToolDisabledError(tool_slug)
        return SettleGridUnavailableError(
            body.error or "API returned 403",
        )
    if status == 404:
        if body.code == "TOOL_NOT_FOUND":
            return ToolNotFoundError(tool_slug)
        return SettleGridUnavailableError(
            body.error or "API returned 404",
        )
    if status == 429:
        # H3 hostile fix — read Retry-After header first, body second,
        # 60-second default third (TS-canonical precedence).
        retry_after_seconds = _resolve_retry_after_seconds(response_headers, body)
        return RateLimitedError.from_seconds(retry_after_seconds)
    if 500 <= status < 600:
        return SettleGridUnavailableError(
            body.error
            or f"SettleGrid API returned {status}; check https://status.settlegrid.ai"
        )
    return SettleGridUnavailableError(
        body.error or f"Unexpected SettleGrid response status {status}"
    )


def _parse_error_body(raw: Any) -> APIErrorBody:  # noqa: ANN401 — JSON boundary
    """Parse a non-2xx response body, swallowing parser errors.

    A non-JSON body (e.g., a misconfigured proxy returning HTML) results
    in an empty :class:`APIErrorBody`. This matches the TS SDK's
    ``response.json().catch(() => ({}))`` defence.
    """
    if not isinstance(raw, dict):
        return APIErrorBody()
    try:
        return APIErrorBody.model_validate(raw)
    except ValidationError:
        return APIErrorBody()


# ─── Client ──────────────────────────────────────────────────────────────


@dataclass
class _AttemptResult:
    """Internal: per-attempt outcome carried through the retry loop."""

    response: httpx.Response | None = None
    error: SettleGridError | None = None
    # Whether the loop should retry (5xx + retries remaining), back off,
    # and continue. Otherwise the result is terminal.
    retry: bool = False
    backoff_ms: int = 0


class SettleGridHTTPClient:
    """Async + sync httpx wrapper with the SettleGrid resilience policy.

    The client is reusable across requests — it lazily creates an
    :class:`httpx.AsyncClient` (or a sync :class:`httpx.Client` for
    ``request_sync``) on first use and closes them via :meth:`aclose` /
    :meth:`close` so the SDK doesn't leak connection pools.
    """

    config: HTTPConfig
    _async_client: httpx.AsyncClient | None
    _sync_client: httpx.Client | None
    _circuit: CircuitBreaker

    def __init__(self, config: HTTPConfig) -> None:
        if config.timeout_ms <= 0 or config.timeout_ms > MAX_TIMEOUT_MS:
            raise ValueError(
                "HTTPConfig.timeout_ms must be in (0, "
                f"{MAX_TIMEOUT_MS}]; got {config.timeout_ms}"
            )
        if config.max_retries < 0:
            raise ValueError(
                f"HTTPConfig.max_retries must be >= 0; got {config.max_retries}"
            )
        self.config = config
        self._async_client = None
        self._sync_client = None
        self._circuit = CircuitBreaker(
            threshold=config.circuit_breaker_threshold,
            cooldown_ms=config.circuit_breaker_cooldown_ms,
        )

    # ─── lifecycle ───────────────────────────────────────────────────

    def _ensure_async_client(self) -> httpx.AsyncClient:
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(
                base_url=self.config.api_url,
                timeout=httpx.Timeout(self.config.timeout_ms / 1000),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": self.config.user_agent,
                },
            )
        return self._async_client

    def _ensure_sync_client(self) -> httpx.Client:
        if self._sync_client is None:
            self._sync_client = httpx.Client(
                base_url=self.config.api_url,
                timeout=httpx.Timeout(self.config.timeout_ms / 1000),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": self.config.user_agent,
                },
            )
        return self._sync_client

    async def aclose(self) -> None:
        if self._async_client is not None:
            await self._async_client.aclose()
            self._async_client = None

    def close(self) -> None:
        if self._sync_client is not None:
            self._sync_client.close()
            self._sync_client = None

    # ─── public entry points ─────────────────────────────────────────

    async def request(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        """Execute a POST against ``/api/sdk{path}`` with retries.

        Returns the parsed JSON response on success, or raises a typed
        :class:`SettleGridError` on failure. Path is prefixed with
        ``/api/sdk`` to mirror the TS middleware.
        """
        self._guard_circuit_open()
        full_path = f"/api/sdk{path}"
        client = self._ensure_async_client()

        max_attempts = max(_MIN_ATTEMPTS, self.config.max_retries + 1)
        for attempt in range(max_attempts):
            attempt_result = await self._do_attempt_async(
                client, full_path, body, attempt, max_attempts
            )
            if attempt_result.retry:
                await asyncio.sleep(attempt_result.backoff_ms / 1000)
                continue
            if attempt_result.error is not None:
                raise attempt_result.error
            assert attempt_result.response is not None  # noqa: S101
            return _parse_success_body(attempt_result.response)

        # Loop exit without return → exhausted retries with 5xx; the
        # last attempt raised SettleGridUnavailableError so this should
        # be unreachable. Defensive throw:
        raise SettleGridUnavailableError(
            "Exhausted retry budget; last attempt did not surface an error"
        )

    def request_sync(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        """Synchronous twin of :meth:`request` — identical semantics."""
        self._guard_circuit_open()
        full_path = f"/api/sdk{path}"
        client = self._ensure_sync_client()

        max_attempts = max(_MIN_ATTEMPTS, self.config.max_retries + 1)
        for attempt in range(max_attempts):
            attempt_result = self._do_attempt_sync(
                client, full_path, body, attempt, max_attempts
            )
            if attempt_result.retry:
                time.sleep(attempt_result.backoff_ms / 1000)
                continue
            if attempt_result.error is not None:
                raise attempt_result.error
            assert attempt_result.response is not None  # noqa: S101
            return _parse_success_body(attempt_result.response)

        raise SettleGridUnavailableError(
            "Exhausted retry budget; last attempt did not surface an error"
        )

    # ─── internal: per-attempt logic ─────────────────────────────────

    def _guard_circuit_open(self) -> None:
        if not self._circuit.can_execute():
            raise SettleGridUnavailableError(
                "Circuit breaker is open — too many consecutive API failures. "
                "Retry after cooldown period."
            )

    async def _do_attempt_async(
        self,
        client: httpx.AsyncClient,
        full_path: str,
        body: dict[str, Any],
        attempt: int,
        max_attempts: int,
    ) -> _AttemptResult:
        try:
            response = await client.post(full_path, json=body)
        except httpx.TimeoutException:
            self._circuit.record_failure()
            return _AttemptResult(error=TimeoutError(self.config.timeout_ms))
        except httpx.RequestError as exc:
            # DNS, connection refused, TLS etc.
            self._circuit.record_failure()
            err_msg = str(exc)
            return _AttemptResult(
                error=NetworkError(err_msg) if err_msg else NetworkError()
            )
        return self._handle_response(response, attempt, max_attempts)

    def _do_attempt_sync(
        self,
        client: httpx.Client,
        full_path: str,
        body: dict[str, Any],
        attempt: int,
        max_attempts: int,
    ) -> _AttemptResult:
        try:
            response = client.post(full_path, json=body)
        except httpx.TimeoutException:
            self._circuit.record_failure()
            return _AttemptResult(error=TimeoutError(self.config.timeout_ms))
        except httpx.RequestError as exc:
            self._circuit.record_failure()
            err_msg = str(exc)
            return _AttemptResult(
                error=NetworkError(err_msg) if err_msg else NetworkError()
            )
        return self._handle_response(response, attempt, max_attempts)

    def _handle_response(
        self,
        response: httpx.Response,
        attempt: int,
        max_attempts: int,
    ) -> _AttemptResult:
        if response.is_success:
            self._circuit.record_success()
            return _AttemptResult(response=response)

        status = response.status_code
        # 5xx with retries remaining: record + backoff + retry
        if 500 <= status < 600 and attempt < max_attempts - 1:
            self._circuit.record_failure()
            backoff_ms = 1000 * (2 ** attempt)  # 1s, 2s, 4s
            return _AttemptResult(retry=True, backoff_ms=backoff_ms)

        if 500 <= status < 600:
            self._circuit.record_failure()

        try:
            raw = response.json()
        except ValueError:
            raw = None
        body = _parse_error_body(raw)
        # Lower-case header names so the lookup in
        # `_resolve_retry_after_seconds` is case-insensitive (HTTP/1.1
        # header names are case-insensitive — httpx returns a
        # case-insensitive multi-dict but we normalize defensively).
        response_headers = {
            k.lower(): v for k, v in response.headers.items()
        }
        error = _map_status_to_error(
            status,
            body,
            tool_slug=self.config.tool_slug,
            response_headers=response_headers,
        )
        return _AttemptResult(error=error)


def _parse_success_body(response: httpx.Response) -> dict[str, Any]:
    """Decode a 2xx response body, raising :class:`NetworkError` on parse failure."""
    try:
        data = response.json()
    except ValueError as exc:
        raise NetworkError(
            f"SettleGrid API returned 2xx with non-JSON body: {exc}"
        ) from exc
    if not isinstance(data, dict):
        raise NetworkError(
            "SettleGrid API returned 2xx with non-object JSON body"
        )
    return data


__all__ = [
    "DEFAULT_API_URL",
    "DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS",
    "DEFAULT_CIRCUIT_BREAKER_THRESHOLD",
    "DEFAULT_MAX_RETRIES",
    "DEFAULT_TIMEOUT_MS",
    "MAX_TIMEOUT_MS",
    "CircuitBreaker",
    "HTTPConfig",
    "SettleGridHTTPClient",
]
