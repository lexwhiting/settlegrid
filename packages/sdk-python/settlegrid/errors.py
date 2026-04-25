"""SettleGrid SDK error classes.

1:1 port of ``@settlegrid/mcp`` errors.ts. Every error extends
:class:`SettleGridError` so a single ``except SettleGridError`` clause
catches any SDK error. Each class carries the same ``code``, ``status_code``,
and instance attributes as the TypeScript counterpart so server responses,
client retries, and error metrics stay consistent across runtimes.

Example::

    from settlegrid import SettleGridError, InvalidKeyError, RateLimitedError

    try:
        sg.validate_key(api_key)
    except InvalidKeyError as exc:
        print(f"bad key: {exc}")
    except RateLimitedError as exc:
        time.sleep(exc.retry_after_seconds)
    except SettleGridError as exc:
        print(f"sdk error [{exc.code}]: {exc}")
"""

from __future__ import annotations

import math
from typing import Literal

# Error code literal type — mirrors `SettleGridErrorCode` in the TS SDK.
SettleGridErrorCode = Literal[
    "INVALID_KEY",
    "INSUFFICIENT_CREDITS",
    "BUDGET_EXCEEDED",
    "TOOL_NOT_FOUND",
    "TOOL_DISABLED",
    "RATE_LIMITED",
    "SERVER_ERROR",
    "NETWORK_ERROR",
    "TIMEOUT",
]


class SettleGridError(Exception):
    """Base error class for all SettleGrid SDK errors.

    Carries an HTTP-compatible :attr:`status_code` and a machine-readable
    :attr:`code`. Mirrors :class:`SettleGridError` from the TypeScript SDK.
    """

    code: SettleGridErrorCode
    status_code: int

    def __init__(
        self,
        message: str,
        code: SettleGridErrorCode,
        status_code: int,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code

    def to_dict(self) -> dict[str, object]:
        """Serialize the error to a JSON-safe dict for API responses.

        Mirrors :meth:`toJSON` in the TS SDK.
        """
        return {
            "error": str(self),
            "code": self.code,
            "status_code": self.status_code,
        }


class InvalidKeyError(SettleGridError):
    """Thrown when an API key is invalid, revoked, expired, or not found."""

    def __init__(
        self,
        message: str = (
            "Invalid or revoked API key. "
            "Verify your key at https://settlegrid.ai/keys"
        ),
    ) -> None:
        super().__init__(message, "INVALID_KEY", 401)


class InsufficientCreditsError(SettleGridError):
    """Thrown when a consumer's credit balance is too low for the call."""

    required_cents: int
    available_cents: int
    top_up_url: str

    def __init__(
        self,
        required_cents: int,
        available_cents: int,
        top_up_url: str | None = None,
    ) -> None:
        # Coalesce ``None`` and empty string to the default top-up URL —
        # mirrors the TS helper's defensive coalescing so the message
        # never contains the literal ``None`` or an empty URL.
        resolved_top_up_url = (
            top_up_url
            if isinstance(top_up_url, str) and len(top_up_url) > 0
            else "https://settlegrid.ai/top-up"
        )
        super().__init__(
            (
                f"Insufficient credits: need {required_cents} cents, "
                f"have {available_cents} cents. "
                f"Top up at {resolved_top_up_url}"
            ),
            "INSUFFICIENT_CREDITS",
            402,
        )
        self.required_cents = required_cents
        self.available_cents = available_cents
        self.top_up_url = resolved_top_up_url


class BudgetExceededError(SettleGridError):
    """Thrown when a buyer-side budget cap blocks an invocation."""

    max_cents: int
    required_cents: int

    def __init__(self, max_cents: int, required_cents: int) -> None:
        super().__init__(
            (
                f"Budget exceeded: settlegrid-max-cost-cents is {max_cents} "
                f"but this call would cost {required_cents} cents. "
                "Increase the cap or omit the header."
            ),
            "BUDGET_EXCEEDED",
            402,
        )
        self.max_cents = max_cents
        self.required_cents = required_cents


class ToolNotFoundError(SettleGridError):
    """Thrown when the requested tool slug is not registered on SettleGrid."""

    def __init__(self, slug: str) -> None:
        super().__init__(
            (
                f'Tool not found: "{slug}". Register it at '
                "https://settlegrid.ai/tools or check for typos in your "
                "tool slug."
            ),
            "TOOL_NOT_FOUND",
            404,
        )


class ToolDisabledError(SettleGridError):
    """Thrown when a tool exists but is disabled or not yet published."""

    def __init__(self, slug: str) -> None:
        super().__init__(
            (
                f'Tool is not active: "{slug}". Enable it in your '
                "SettleGrid dashboard at https://settlegrid.ai/tools."
            ),
            "TOOL_DISABLED",
            403,
        )


class RateLimitedError(SettleGridError):
    """Thrown when the consumer has exceeded their rate limit."""

    retry_after_ms: int

    def __init__(self, retry_after_ms: int) -> None:
        super().__init__(
            f"Rate limit exceeded. Retry after {retry_after_ms}ms.",
            "RATE_LIMITED",
            429,
        )
        self.retry_after_ms = retry_after_ms

    @property
    def retry_after_seconds(self) -> int:
        """Retry delay in integer seconds (matches HTTP ``Retry-After``)."""
        return self.retry_after_ms // 1000

    @classmethod
    def from_seconds(cls, retry_after_seconds: float) -> RateLimitedError:
        """Construct from an HTTP ``Retry-After`` integer-seconds value.

        Mirrors :meth:`RateLimitedError.fromSeconds` in the TS SDK. The
        round-trip through :attr:`retry_after_seconds` is lossless because
        the input is floored to integer seconds before conversion.
        """
        if (
            not isinstance(retry_after_seconds, (int, float))
            or isinstance(retry_after_seconds, bool)
            or not math.isfinite(retry_after_seconds)
            or retry_after_seconds < 0
        ):
            raise TypeError(
                "RateLimitedError.from_seconds requires a finite "
                f"non-negative number, got {retry_after_seconds!r}"
            )
        return cls(int(math.floor(retry_after_seconds)) * 1000)


class SettleGridUnavailableError(SettleGridError):
    """Thrown when the SettleGrid API is temporarily unavailable (5xx)."""

    def __init__(
        self,
        message: str = (
            "SettleGrid API is temporarily unavailable. "
            "Check https://status.settlegrid.ai for status."
        ),
    ) -> None:
        super().__init__(message, "SERVER_ERROR", 503)


class NetworkError(SettleGridError):
    """Thrown on network failures (DNS resolution, connection refused, etc.)."""

    def __init__(
        self,
        message: str = (
            "Network error connecting to SettleGrid. "
            "Check your internet connection and firewall rules."
        ),
    ) -> None:
        super().__init__(message, "NETWORK_ERROR", 503)


class TimeoutError(SettleGridError):  # noqa: A001 — mirrors TS class name
    """Thrown when a SettleGrid API request times out.

    The class deliberately shadows the built-in :class:`TimeoutError`
    for SDK callers because the public surface mirrors the TS SDK 1:1.
    Importing ``from settlegrid import TimeoutError`` shadows the
    built-in within that scope; importers who need both can alias one of
    them at the import site (``from settlegrid import TimeoutError as
    SgTimeoutError``).
    """

    timeout_ms: int

    def __init__(self, timeout_ms: int) -> None:
        super().__init__(
            (
                f"Request timed out after {timeout_ms}ms. "
                "Increase timeout_ms in your SDK config (max: 30000) "
                "or check network latency."
            ),
            "TIMEOUT",
            504,
        )
        self.timeout_ms = timeout_ms


__all__ = [
    "BudgetExceededError",
    "InsufficientCreditsError",
    "InvalidKeyError",
    "NetworkError",
    "RateLimitedError",
    "SettleGridError",
    "SettleGridErrorCode",
    "SettleGridUnavailableError",
    "TimeoutError",
    "ToolDisabledError",
    "ToolNotFoundError",
]
