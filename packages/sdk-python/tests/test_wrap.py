"""Coverage tests for ``settlegrid.wrap.Wrapper`` / ``Invocation``.

Covers:
- Constructor validation (meter, price_cents, api_key shape).
- Decorator: sync and async paths (validate → handler → meter ordering).
- Decorator: handler raise → no meter call.
- Context manager: success → meter; raise → skip; void → skip.
- Re-entry guard.
- Invalid-key short-circuit before handler runs.

Uses real ``respx`` mocks against a real ``SettleGrid`` instance so the
test verifies the full wire interaction, not stubbed-out internals.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from settlegrid import (
    InvalidKeyError,
    Invocation,
    SettleGrid,
)

API_URL = "https://api.test"
SELLER_KEY = "sg_live_seller_key"
BUYER_KEY = "sg_live_buyer_key"


def _make_sdk() -> SettleGrid:
    return SettleGrid(
        api_key=SELLER_KEY,
        tool_slug="test-tool",
        api_url=API_URL,
    )


def _valid_key_response() -> Response:
    return Response(
        200,
        json={
            "valid": True,
            "balanceCents": 5000,
            "consumerId": "cust_buyer",
            "toolId": "tool_test",
            "keyId": "key_buyer",
        },
    )


def _invalid_key_response() -> Response:
    return Response(
        200,
        json={
            "valid": False,
            "balanceCents": 0,
            "consumerId": "",
            "toolId": "",
            "keyId": "",
        },
    )


def _meter_response(cost: int = 10) -> Response:
    return Response(
        200,
        json={
            "success": True,
            "remainingBalanceCents": 4990,
            "costCents": cost,
            "invocationId": "inv_x",
        },
    )


# ─── constructor validation ─────────────────────────────────────────────


class TestWrapperInit:
    def test_rejects_empty_meter(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="meter"):
            sg.wrap(meter="", price_cents=10)
        sg.close()

    def test_rejects_whitespace_meter(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="meter"):
            sg.wrap(meter="   ", price_cents=10)
        sg.close()

    def test_rejects_non_string_meter(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="meter"):
            sg.wrap(meter=42, price_cents=10)  # type: ignore[arg-type]
        sg.close()

    def test_rejects_bool_price_cents(self):
        sg = _make_sdk()
        with pytest.raises(TypeError, match="price_cents"):
            sg.wrap(meter="search", price_cents=True)  # type: ignore[arg-type]
        sg.close()

    def test_rejects_float_price_cents(self):
        sg = _make_sdk()
        with pytest.raises(TypeError, match="price_cents"):
            sg.wrap(meter="search", price_cents=1.5)  # type: ignore[arg-type]
        sg.close()

    def test_rejects_negative_price_cents(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match=">= 0"):
            sg.wrap(meter="search", price_cents=-1)
        sg.close()

    def test_zero_price_cents_allowed(self):
        sg = _make_sdk()
        w = sg.wrap(meter="search", price_cents=0)
        assert w.price_cents == 0
        sg.close()

    def test_rejects_empty_api_key(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="api_key"):
            sg.wrap(meter="search", price_cents=10, api_key="")
        sg.close()

    def test_rejects_non_string_api_key(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="api_key"):
            sg.wrap(meter="search", price_cents=10, api_key=42)  # type: ignore[arg-type]
        sg.close()


# ─── Invocation behavior ────────────────────────────────────────────────


class TestInvocation:
    def test_void_idempotent(self):
        inv = Invocation(
            meter="m",
            price_cents=10,
            api_key=BUYER_KEY,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        inv.void()
        inv.void()
        assert inv.voided is True
        assert inv.charged is False

    def test_void_after_charged_raises(self):
        inv = Invocation(
            meter="m",
            price_cents=10,
            api_key=BUYER_KEY,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        inv._mark_charged()
        with pytest.raises(RuntimeError, match="already been charged"):
            inv.void()

    def test_initial_state(self):
        inv = Invocation(
            meter="m",
            price_cents=10,
            api_key=BUYER_KEY,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        assert inv.voided is False
        assert inv.charged is False

    def test_mark_charged(self):
        inv = Invocation(
            meter="m",
            price_cents=10,
            api_key=BUYER_KEY,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        inv._mark_charged()
        assert inv.charged is True


# ─── decorator (sync) ───────────────────────────────────────────────────


class TestDecoratorSync:
    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_decorator_runs_handler_then_meters(self, respx_mock):
        sg = _make_sdk()
        validate_route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response(10)
        )

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(q: str) -> str:
            return f"results for {q}"

        result = search("python")
        assert result == "results for python"
        assert validate_route.called
        assert meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_handler_raises_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response(10)
        )

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        def boom(q: str) -> str:
            raise RuntimeError("handler crashed")

        with pytest.raises(RuntimeError, match="handler crashed"):
            boom("x")
        # H1 hostile fix verification — meter must NOT be called when
        # the handler raises. TS execute() semantics: pay-only-for-success.
        assert not meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_invalid_key_short_circuits_before_handler(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_invalid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response(10)
        )

        handler_calls = []

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(q: str) -> str:
            handler_calls.append(q)
            return "ok"

        with pytest.raises(InvalidKeyError):
            search("anything")
        assert handler_calls == []
        assert not meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_runtime_kwarg_overrides_default_key(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        respx_mock.post("/api/sdk/meter").mock(return_value=_meter_response())

        seen_args = {}

        @sg.wrap(meter="search", price_cents=10)  # no default api_key
        def search(q: str, *, lang: str = "en") -> str:
            seen_args["q"] = q
            seen_args["lang"] = lang
            return q.upper()

        result = search("hi", lang="fr", _settlegrid_api_key=BUYER_KEY)
        assert result == "HI"
        # Verify the reserved kwarg got popped — handler should NOT
        # receive it.
        assert "_settlegrid_api_key" not in seen_args
        assert seen_args == {"q": "hi", "lang": "fr"}
        sg.close()

    def test_decorator_target_must_be_callable(self):
        sg = _make_sdk()
        w = sg.wrap(meter="search", price_cents=10)
        with pytest.raises(TypeError, match="callable"):
            w(42)  # type: ignore[arg-type]
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_decorator_preserves_metadata(self, respx_mock):
        sg = _make_sdk()

        @sg.wrap(meter="search", price_cents=10)
        def documented(q: str) -> str:
            """Look stuff up."""
            return q

        assert documented.__name__ == "documented"
        assert documented.__doc__ == "Look stuff up."
        sg.close()


# ─── decorator (async) ──────────────────────────────────────────────────


class TestDecoratorAsync:
    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_async_decorator_runs_handler_then_meters(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response(15)
        )

        @sg.wrap(meter="search", price_cents=15, api_key=BUYER_KEY)
        async def search(q: str) -> str:
            return f"results for {q}"

        result = await search("py")
        assert result == "results for py"
        assert meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_async_handler_raises_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response(10)
        )

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        async def boom(q: str) -> str:
            raise RuntimeError("async crash")

        with pytest.raises(RuntimeError, match="async crash"):
            await boom("x")
        assert not meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_async_invalid_key_short_circuits(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_invalid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        async def search(q: str) -> str:
            return q

        with pytest.raises(InvalidKeyError):
            await search("x")
        assert not meter_route.called
        await sg.aclose()


# ─── sync context manager ───────────────────────────────────────────────


class TestSyncContextManager:
    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_success_path_meters(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY) as inv:
            assert isinstance(inv, Invocation)
            assert inv.meter == "search"
            assert inv.price_cents == 10
            # User code happens here

        assert meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_void_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY) as inv:
            inv.void()

        assert not meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_raise_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with (
            pytest.raises(ValueError, match="user crash"),
            sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY),
        ):
            raise ValueError("user crash")

        # Exception escaped → auto-void, no meter charge.
        assert not meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_invalid_key_in_enter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_invalid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with (
            pytest.raises(InvalidKeyError),
            sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY),
        ):
            pytest.fail("should not enter the block")

        assert not meter_route.called
        sg.close()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_reentry_rejected(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        respx_mock.post("/api/sdk/meter").mock(return_value=_meter_response())

        w = sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        with w, pytest.raises(RuntimeError, match="not re-entrant"), w:
            pass
        sg.close()


# ─── async context manager ──────────────────────────────────────────────


class TestAsyncContextManager:
    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_success_path_meters(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        async with sg.wrap(
            meter="search", price_cents=10, api_key=BUYER_KEY
        ) as inv:
            assert isinstance(inv, Invocation)

        assert meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_void_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        async with sg.wrap(
            meter="search", price_cents=10, api_key=BUYER_KEY
        ) as inv:
            inv.void()

        assert not meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_raise_skips_meter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with pytest.raises(ValueError, match="async crash"):
            async with sg.wrap(
                meter="search", price_cents=10, api_key=BUYER_KEY
            ):
                raise ValueError("async crash")

        assert not meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_invalid_key_in_aenter(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_invalid_key_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        with pytest.raises(InvalidKeyError):
            async with sg.wrap(
                meter="search", price_cents=10, api_key=BUYER_KEY
            ):
                pytest.fail("should not enter")

        assert not meter_route.called
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    async def test_async_reentry_rejected(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_valid_key_response()
        )
        respx_mock.post("/api/sdk/meter").mock(return_value=_meter_response())

        w = sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        async with w:
            with pytest.raises(RuntimeError, match="not re-entrant"):
                async with w:
                    pass
        await sg.aclose()
