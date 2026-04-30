"""Port of ``packages/mcp/src/__tests__/errors.test.ts``.

Exhaustive error-class behavior: properties, JSON serialization, message
contents, default values, instance identity. Mirrors every TS error test
plus a few Python-specific ones (TimeoutError shadowing the builtin).
"""

from __future__ import annotations

import math

import pytest

from settlegrid import (
    BudgetExceededError,
    InsufficientCreditsError,
    InvalidKeyError,
    NetworkError,
    RateLimitedError,
    SettleGridError,
    SettleGridUnavailableError,
    ToolDisabledError,
    ToolNotFoundError,
)
from settlegrid import (
    TimeoutError as SgTimeoutError,
)

# ─── SettleGridError base ───────────────────────────────────────────────


class TestSettleGridErrorBase:
    def test_has_correct_properties(self) -> None:
        err = SettleGridError("oops", "INVALID_KEY", 401)
        assert err.code == "INVALID_KEY"
        assert err.status_code == 401
        assert "oops" in str(err)

    def test_serializes_to_dict(self) -> None:
        err = SettleGridError("oops", "INVALID_KEY", 401)
        assert err.to_dict() == {
            "error": "oops",
            "code": "INVALID_KEY",
            "status_code": 401,
        }

    def test_is_an_instance_of_exception(self) -> None:
        err = SettleGridError("oops", "INVALID_KEY", 401)
        assert isinstance(err, Exception)


# ─── InvalidKeyError ────────────────────────────────────────────────────


class TestInvalidKeyError:
    def test_uses_default_message(self) -> None:
        err = InvalidKeyError()
        assert "Invalid or revoked" in str(err)
        assert err.code == "INVALID_KEY"
        assert err.status_code == 401

    def test_accepts_custom_message(self) -> None:
        err = InvalidKeyError("custom reason")
        assert "custom reason" in str(err)

    def test_default_message_links_to_keys_page(self) -> None:
        err = InvalidKeyError()
        assert "settlegrid.ai/keys" in str(err)


# ─── InsufficientCreditsError ───────────────────────────────────────────


class TestInsufficientCreditsError:
    def test_includes_credit_amounts(self) -> None:
        err = InsufficientCreditsError(100, 50)
        assert err.required_cents == 100
        assert err.available_cents == 50
        assert err.code == "INSUFFICIENT_CREDITS"
        assert err.status_code == 402

    def test_message_includes_cents(self) -> None:
        err = InsufficientCreditsError(150, 25)
        msg = str(err)
        assert "150" in msg
        assert "25" in msg

    def test_default_top_up_url(self) -> None:
        err = InsufficientCreditsError(100, 50)
        assert err.top_up_url == "https://settlegrid.ai/top-up"

    def test_custom_top_up_url(self) -> None:
        err = InsufficientCreditsError(100, 50, "https://example.com/topup")
        assert err.top_up_url == "https://example.com/topup"
        assert "https://example.com/topup" in str(err)

    def test_none_falls_back_to_default(self) -> None:
        err = InsufficientCreditsError(100, 50, None)
        assert err.top_up_url == "https://settlegrid.ai/top-up"

    def test_empty_falls_back_to_default(self) -> None:
        err = InsufficientCreditsError(100, 50, "")
        assert err.top_up_url == "https://settlegrid.ai/top-up"


# ─── BudgetExceededError ────────────────────────────────────────────────


class TestBudgetExceededError:
    def test_includes_amounts(self) -> None:
        err = BudgetExceededError(100, 200)
        assert err.max_cents == 100
        assert err.required_cents == 200
        assert err.code == "BUDGET_EXCEEDED"
        assert err.status_code == 402

    def test_message_mentions_budget_header(self) -> None:
        err = BudgetExceededError(100, 200)
        assert "settlegrid-max-cost-cents" in str(err)


# ─── ToolNotFoundError ──────────────────────────────────────────────────


class TestToolNotFoundError:
    def test_includes_slug_in_message(self) -> None:
        err = ToolNotFoundError("my-tool")
        assert "my-tool" in str(err)
        assert err.code == "TOOL_NOT_FOUND"
        assert err.status_code == 404

    def test_message_links_to_tools_page(self) -> None:
        err = ToolNotFoundError("x")
        assert "settlegrid.ai/tools" in str(err)


# ─── ToolDisabledError ──────────────────────────────────────────────────


class TestToolDisabledError:
    def test_includes_slug_in_message(self) -> None:
        err = ToolDisabledError("my-tool")
        assert "my-tool" in str(err)
        assert err.code == "TOOL_DISABLED"
        assert err.status_code == 403

    def test_message_mentions_dashboard(self) -> None:
        err = ToolDisabledError("x")
        assert "dashboard" in str(err) or "settlegrid.ai/tools" in str(err)


# ─── RateLimitedError ───────────────────────────────────────────────────


class TestRateLimitedError:
    def test_includes_retry_after(self) -> None:
        err = RateLimitedError(15_000)
        assert err.retry_after_ms == 15_000
        assert err.retry_after_seconds == 15
        assert "15000" in str(err) or "15_000" in str(err)
        assert err.code == "RATE_LIMITED"
        assert err.status_code == 429

    def test_from_seconds_round_trip(self) -> None:
        err = RateLimitedError.from_seconds(30)
        assert err.retry_after_ms == 30_000
        assert err.retry_after_seconds == 30

    def test_from_seconds_handles_fractional(self) -> None:
        # Fractional seconds floor to integer.
        err = RateLimitedError.from_seconds(2.7)
        assert err.retry_after_ms == 2_000
        assert err.retry_after_seconds == 2

    def test_from_seconds_handles_zero(self) -> None:
        err = RateLimitedError.from_seconds(0)
        assert err.retry_after_ms == 0
        assert err.retry_after_seconds == 0

    @pytest.mark.parametrize("bad", [-1, -0.5])
    def test_from_seconds_rejects_negative(self, bad: float) -> None:
        with pytest.raises(TypeError):
            RateLimitedError.from_seconds(bad)

    def test_from_seconds_rejects_nan(self) -> None:
        with pytest.raises(TypeError):
            RateLimitedError.from_seconds(math.nan)

    @pytest.mark.parametrize("bad", [math.inf, -math.inf])
    def test_from_seconds_rejects_infinity(self, bad: float) -> None:
        with pytest.raises(TypeError):
            RateLimitedError.from_seconds(bad)

    @pytest.mark.parametrize("bad", ["5", None, [], {}, True])
    def test_from_seconds_rejects_non_number(self, bad: object) -> None:
        with pytest.raises(TypeError):
            RateLimitedError.from_seconds(bad)  # type: ignore[arg-type]


# ─── SettleGridUnavailableError ─────────────────────────────────────────


class TestSettleGridUnavailableError:
    def test_uses_default_message(self) -> None:
        err = SettleGridUnavailableError()
        assert "temporarily unavailable" in str(err)
        assert err.code == "SERVER_ERROR"
        assert err.status_code == 503

    def test_accepts_custom_message(self) -> None:
        err = SettleGridUnavailableError("upstream timeout")
        assert "upstream timeout" in str(err)

    def test_message_mentions_status_page(self) -> None:
        err = SettleGridUnavailableError()
        assert "status.settlegrid.ai" in str(err)


# ─── NetworkError ───────────────────────────────────────────────────────


class TestNetworkError:
    def test_uses_default_message(self) -> None:
        err = NetworkError()
        assert "Network error" in str(err)
        assert err.code == "NETWORK_ERROR"
        assert err.status_code == 503

    def test_accepts_custom_message(self) -> None:
        err = NetworkError("dns failure")
        assert "dns failure" in str(err)


# ─── TimeoutError (SDK class — shadows builtin) ─────────────────────────


class TestSgTimeoutError:
    def test_includes_timeout_value(self) -> None:
        err = SgTimeoutError(5_000)
        assert err.timeout_ms == 5_000
        assert "5000" in str(err)
        assert err.code == "TIMEOUT"
        assert err.status_code == 504

    def test_message_mentions_timeout_config(self) -> None:
        err = SgTimeoutError(5_000)
        assert "timeout_ms" in str(err) or "Increase timeout" in str(err)

    def test_extends_settlegrid_error_not_builtin_timeout(self) -> None:
        """The SDK class deliberately shadows :class:`builtins.TimeoutError`.
        Confirm it's our class — not the asyncio builtin — by checking
        ``code`` attribute."""
        err = SgTimeoutError(1_000)
        assert isinstance(err, SettleGridError)
        assert hasattr(err, "code")


# ─── to_dict serialization across all error types ───────────────────────


class TestToDictAcrossErrors:
    @pytest.mark.parametrize(
        "err",
        [
            InvalidKeyError(),
            InsufficientCreditsError(100, 50),
            BudgetExceededError(100, 200),
            ToolNotFoundError("x"),
            ToolDisabledError("x"),
            RateLimitedError(5_000),
            SettleGridUnavailableError(),
            NetworkError(),
            SgTimeoutError(1_000),
        ],
    )
    def test_to_dict_returns_correct_shape(
        self, err: SettleGridError
    ) -> None:
        payload = err.to_dict()
        assert set(payload.keys()) == {"error", "code", "status_code"}
        assert payload["code"] == err.code
        assert payload["status_code"] == err.status_code
        assert isinstance(payload["error"], str)
