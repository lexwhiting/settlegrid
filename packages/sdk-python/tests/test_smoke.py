"""P3.PYTHON1 — Scaffold smoke tests.

These tests verify the SDK surface compiles, exports the documented
public names, and rejects malformed input cleanly. Real API integration
+ exhaustive coverage land in P3.PYTHON2.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from settlegrid import (
    SDK_VERSION,
    APIErrorBody,
    BudgetExceededError,
    InsufficientCreditsError,
    InvalidKeyError,
    Invocation,
    KeyValidationCache,
    KeyValidationResult,
    LRUCache,
    MeterResult,
    NetworkError,
    RateLimitedError,
    SettleGrid,
    SettleGridError,
    SettleGridUnavailableError,
    TimeoutError,
    ToolDisabledError,
    ToolNotFoundError,
    Wrapper,
    __version__,
)

# ─── Surface ────────────────────────────────────────────────────────────


class TestPublicSurface:
    """Sanity checks on the documented public exports."""

    def test_version_is_a_string(self) -> None:
        assert isinstance(SDK_VERSION, str)
        assert __version__ == SDK_VERSION

    def test_settlegrid_is_a_class(self) -> None:
        assert isinstance(SettleGrid, type)

    def test_wrapper_and_invocation_are_classes(self) -> None:
        assert isinstance(Wrapper, type)
        assert isinstance(Invocation, type)

    @pytest.mark.parametrize(
        "cls",
        [
            SettleGridError,
            InvalidKeyError,
            InsufficientCreditsError,
            BudgetExceededError,
            ToolNotFoundError,
            ToolDisabledError,
            RateLimitedError,
            SettleGridUnavailableError,
            NetworkError,
            TimeoutError,
        ],
    )
    def test_error_classes_extend_settlegrid_error(self, cls: type) -> None:
        assert issubclass(cls, SettleGridError)
        # All extend Exception too.
        assert issubclass(cls, Exception)


# ─── Errors ─────────────────────────────────────────────────────────────


class TestErrorClasses:
    def test_settlegrid_error_carries_code_and_status(self) -> None:
        err = SettleGridError("boom", "INVALID_KEY", 401)
        assert err.code == "INVALID_KEY"
        assert err.status_code == 401
        assert "boom" in str(err)

    def test_invalid_key_error_default_message(self) -> None:
        err = InvalidKeyError()
        assert err.code == "INVALID_KEY"
        assert err.status_code == 401
        assert "Invalid or revoked" in str(err)

    def test_insufficient_credits_error_carries_amounts(self) -> None:
        err = InsufficientCreditsError(100, 50, "https://example.com/topup")
        assert err.required_cents == 100
        assert err.available_cents == 50
        assert err.top_up_url == "https://example.com/topup"
        assert err.code == "INSUFFICIENT_CREDITS"
        assert err.status_code == 402

    def test_insufficient_credits_falls_back_to_default_top_up_url(self) -> None:
        err_none = InsufficientCreditsError(100, 50, None)
        err_empty = InsufficientCreditsError(100, 50, "")
        assert err_none.top_up_url == "https://settlegrid.ai/top-up"
        assert err_empty.top_up_url == "https://settlegrid.ai/top-up"

    def test_budget_exceeded_carries_amounts(self) -> None:
        err = BudgetExceededError(100, 200)
        assert err.max_cents == 100
        assert err.required_cents == 200
        assert err.code == "BUDGET_EXCEEDED"
        assert err.status_code == 402

    def test_rate_limited_error_seconds_round_trip(self) -> None:
        err = RateLimitedError.from_seconds(15)
        assert err.retry_after_ms == 15_000
        assert err.retry_after_seconds == 15

    def test_rate_limited_error_floors_fractional_seconds(self) -> None:
        err = RateLimitedError.from_seconds(2.7)
        assert err.retry_after_ms == 2_000
        assert err.retry_after_seconds == 2

    @pytest.mark.parametrize("bad", [-1, float("inf"), float("nan"), "5", True])
    def test_rate_limited_error_rejects_bad_seconds(self, bad: object) -> None:
        with pytest.raises(TypeError):
            RateLimitedError.from_seconds(bad)  # type: ignore[arg-type]

    def test_to_dict_serializes(self) -> None:
        err = InvalidKeyError("nope")
        payload = err.to_dict()
        assert payload == {
            "error": "nope",
            "code": "INVALID_KEY",
            "status_code": 401,
        }


# ─── Pydantic types ─────────────────────────────────────────────────────


class TestPydanticTypes:
    def test_key_validation_result_round_trips_camelcase_wire_format(self) -> None:
        wire = {
            "valid": True,
            "consumerId": "cons_abc",
            "toolId": "tool_xyz",
            "keyId": "key_123",
            "balanceCents": 5000,
        }
        result = KeyValidationResult.model_validate(wire)
        assert result.valid is True
        assert result.consumer_id == "cons_abc"
        assert result.balance_cents == 5000
        # Round-trip back to camelCase wire format (exclude_none — unset
        # optional fields are never serialized, per the module contract)
        emitted = result.model_dump(by_alias=True, exclude_none=True)
        assert emitted == wire

    def test_meter_result_rejects_negative_balance(self) -> None:
        with pytest.raises(ValidationError):
            MeterResult.model_validate(
                {
                    "success": True,
                    "remainingBalanceCents": -1,
                    "costCents": 10,
                    "invocationId": "inv_1",
                }
            )

    def test_strict_mode_rejects_string_to_int_coercion(self) -> None:
        # Strict mode means "5000" (string) doesn't coerce to int 5000.
        with pytest.raises(ValidationError):
            KeyValidationResult.model_validate(
                {
                    "valid": True,
                    "consumerId": "c",
                    "toolId": "t",
                    "keyId": "k",
                    "balanceCents": "5000",
                }
            )

    def test_extra_field_rejected(self) -> None:
        with pytest.raises(ValidationError):
            KeyValidationResult.model_validate(
                {
                    "valid": True,
                    "consumerId": "c",
                    "toolId": "t",
                    "keyId": "k",
                    "balanceCents": 0,
                    "unexpected_field": "boom",
                }
            )

    def test_api_error_body_tolerates_unknown_fields(self) -> None:
        # APIErrorBody must NOT reject unknown fields — server adding new
        # fields shouldn't break old clients.
        body = APIErrorBody.model_validate(
            {
                "error": "bad",
                "code": "INVALID_KEY",
                "future_field": True,
            }
        )
        assert body.error == "bad"
        assert body.code == "INVALID_KEY"


# ─── Cache ──────────────────────────────────────────────────────────────


class TestCache:
    def _result(self, balance: int = 100) -> KeyValidationResult:
        return KeyValidationResult.model_validate(
            {
                "valid": True,
                "consumerId": "c",
                "toolId": "t",
                "keyId": "k",
                "balanceCents": balance,
            }
        )

    def test_cache_get_set_round_trip(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("abc", self._result(50))
        got = cache.get("abc")
        assert got is not None
        assert got.balance_cents == 50

    def test_cache_invalidate_idempotent(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.invalidate("missing")  # no error
        cache.set("k", self._result())
        cache.invalidate("k")
        assert cache.get("k") is None

    def test_cache_clear_empties_cache(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", self._result())
        cache.set("b", self._result())
        cache.clear()
        assert cache.size == 0

    def test_cache_evicts_oldest_when_full(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=2, ttl_seconds=60
        )
        cache.set("a", self._result(1))
        cache.set("b", self._result(2))
        cache.set("c", self._result(3))  # evicts 'a'
        assert cache.get("a") is None
        assert cache.get("b") is not None
        assert cache.get("c") is not None

    @pytest.mark.parametrize("bad_size", [0, -1])
    def test_cache_rejects_bad_max_size(self, bad_size: int) -> None:
        with pytest.raises(ValueError):
            KeyValidationCache(max_size=bad_size, ttl_seconds=60)

    @pytest.mark.parametrize("bad_ttl", [0, -1])
    def test_cache_rejects_bad_ttl(self, bad_ttl: int) -> None:
        with pytest.raises(ValueError):
            KeyValidationCache(max_size=10, ttl_seconds=bad_ttl)

    def test_cache_prune_returns_removed_count(self) -> None:
        """``prune()`` removes expired entries and returns the count."""
        import time

        # 0.05s TTL so we can sleep past expiry quickly.
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=0.05
        )
        cache.set("a", self._result(1))
        cache.set("b", self._result(2))
        # Before expiry: nothing to prune.
        assert cache.prune() == 0
        time.sleep(0.1)  # Past TTL.
        # After expiry: both entries pruned.
        assert cache.prune() == 2
        assert cache.size == 0


# ─── SettleGrid client ──────────────────────────────────────────────────


class TestSettleGridConstructor:
    def test_requires_api_key(self) -> None:
        with pytest.raises(ValueError):
            SettleGrid(api_key="")

    def test_requires_non_whitespace_api_key(self) -> None:
        with pytest.raises(ValueError):
            SettleGrid(api_key="   ")

    def test_constructs_with_minimum_args(self) -> None:
        sg = SettleGrid(api_key="sg_live_test")
        assert sg.api_key == "sg_live_test"
        assert sg.tool_slug == ""
        assert sg.cache_size == 0

    def test_rejects_invalid_timeout(self) -> None:
        with pytest.raises(ValueError):
            SettleGrid(api_key="sg_live_test", timeout_ms=0)
        with pytest.raises(ValueError):
            SettleGrid(api_key="sg_live_test", timeout_ms=999_999)

    def test_clear_cache_is_idempotent(self) -> None:
        sg = SettleGrid(api_key="sg_live_test")
        sg.clear_cache()
        sg.clear_cache()
        assert sg.cache_size == 0


# ─── Wrap (decorator + context manager surface only) ────────────────────


class TestWrapSurface:
    def _sg(self) -> SettleGrid:
        return SettleGrid(api_key="sg_live_test")

    def test_wrap_returns_a_wrapper(self) -> None:
        sg = self._sg()
        w = sg.wrap(meter="search", price_cents=10)
        assert isinstance(w, Wrapper)
        assert w.meter == "search"
        assert w.price_cents == 10

    def test_wrap_rejects_negative_price(self) -> None:
        sg = self._sg()
        with pytest.raises(ValueError):
            sg.wrap(meter="search", price_cents=-1)

    def test_wrap_rejects_empty_meter(self) -> None:
        sg = self._sg()
        with pytest.raises(ValueError):
            sg.wrap(meter="", price_cents=1)

    def test_wrap_rejects_bool_price_cents(self) -> None:
        # `True` is an int subclass in Python — guard against it.
        sg = self._sg()
        with pytest.raises(TypeError):
            sg.wrap(meter="search", price_cents=True)  # type: ignore[arg-type]

    def test_decorator_preserves_function_metadata(self) -> None:
        sg = self._sg()
        wrapper = sg.wrap(meter="search", price_cents=0)

        @wrapper
        def my_tool(query: str) -> str:
            """The original docstring."""
            return f"r:{query}"

        assert my_tool.__name__ == "my_tool"
        assert my_tool.__doc__ == "The original docstring."

    def test_decorator_target_must_be_callable(self) -> None:
        sg = self._sg()
        wrapper = sg.wrap(meter="search", price_cents=0)
        with pytest.raises(TypeError):
            wrapper(42)  # type: ignore[arg-type]

    def test_invocation_void_is_idempotent(self) -> None:
        inv = Invocation(
            meter="m",
            price_cents=1,
            api_key="k",
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        inv.void()
        inv.void()  # double-void is fine
        assert inv.voided is True

    def test_invocation_void_after_charge_raises(self) -> None:
        inv = Invocation(
            meter="m",
            price_cents=1,
            api_key="k",
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        inv._mark_charged()
        with pytest.raises(RuntimeError):
            inv.void()
