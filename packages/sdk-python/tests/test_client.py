"""Coverage tests for ``settlegrid.client.SettleGrid``.

Exercises validate_key (sync + async), meter (sync + async), wrap dispatch,
clear_cache, cache_size, and the input-validation guards. Uses ``respx`` to
stub the HTTP layer so the tests don't hit a real network.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from settlegrid import (
    InvalidKeyError,
    KeyValidationResult,
    MeterResult,
    SettleGrid,
)

API_URL = "https://api.test"
SELLER_KEY = "sg_live_seller_key"
BUYER_KEY = "sg_live_buyer_key"


def _make_sdk(**overrides) -> SettleGrid:
    return SettleGrid(
        api_key=SELLER_KEY,
        tool_slug="test-tool",
        api_url=API_URL,
        **overrides,
    )


# ─── constructor validation ─────────────────────────────────────────────


class TestConstructor:
    def test_rejects_empty_api_key(self):
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key="")

    def test_rejects_whitespace_api_key(self):
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key="   ")

    def test_rejects_non_string_api_key(self):
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key=42)  # type: ignore[arg-type]

    def test_rejects_non_string_tool_slug(self):
        with pytest.raises(TypeError, match="tool_slug"):
            SettleGrid(api_key=SELLER_KEY, tool_slug=42)  # type: ignore[arg-type]

    def test_strips_trailing_slash_on_api_url(self):
        sg = SettleGrid(api_key=SELLER_KEY, api_url="https://api.test/")
        # Internal field for verification only
        assert sg._http.config.api_url == "https://api.test"


# ─── _guard_buyer_key / _guard_meter_args ───────────────────────────────


class TestInputGuards:
    def test_guard_buyer_key_rejects_empty(self):
        with pytest.raises(InvalidKeyError, match="non-empty"):
            SettleGrid._guard_buyer_key("", op="validate_key")

    def test_guard_buyer_key_rejects_whitespace(self):
        with pytest.raises(InvalidKeyError, match="non-empty"):
            SettleGrid._guard_buyer_key("   ", op="validate_key")

    def test_guard_buyer_key_rejects_non_string(self):
        with pytest.raises(InvalidKeyError, match="non-empty"):
            SettleGrid._guard_buyer_key(42, op="validate_key")  # type: ignore[arg-type]

    def test_guard_meter_args_rejects_empty_method(self):
        with pytest.raises(ValueError, match="non-empty method"):
            SettleGrid._guard_meter_args(
                BUYER_KEY, "", 10, op="meter"
            )

    def test_guard_meter_args_rejects_bool_cost(self):
        with pytest.raises(TypeError, match="cost_cents"):
            SettleGrid._guard_meter_args(
                BUYER_KEY, "search", True, op="meter"  # type: ignore[arg-type]
            )

    def test_guard_meter_args_rejects_float_cost(self):
        with pytest.raises(TypeError, match="cost_cents"):
            SettleGrid._guard_meter_args(
                BUYER_KEY, "search", 1.5, op="meter"  # type: ignore[arg-type]
            )

    def test_guard_meter_args_rejects_negative_cost(self):
        with pytest.raises(ValueError, match=">= 0"):
            SettleGrid._guard_meter_args(
                BUYER_KEY, "search", -1, op="meter"
            )


# ─── validate_key sync ──────────────────────────────────────────────────


class TestValidateKeySync:
    @respx.mock(base_url=API_URL)
    def test_valid_key_round_trip(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": True,
                    "balanceCents": 5000,
                    "consumerId": "cust_abc",
                    "toolId": "tool_xyz",
                    "keyId": "key_123",
                },
            )
        )
        result = sg.validate_key(BUYER_KEY)
        assert isinstance(result, KeyValidationResult)
        assert result.valid is True
        assert result.balance_cents == 5000
        assert result.consumer_id == "cust_abc"
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_caches_result(self, respx_mock):
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": True,
                    "balanceCents": 100,
                    "consumerId": "cust_a",
                    "toolId": "tool_a",
                    "keyId": "key_a",
                },
            )
        )
        sg.validate_key(BUYER_KEY)
        sg.validate_key(BUYER_KEY)
        sg.validate_key(BUYER_KEY)
        # Cache hit: only one HTTP call
        assert route.call_count == 1
        assert sg.cache_size == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_caches_invalid_result_too(self, respx_mock):
        """Negative caching — bad keys cached so typo storms don't hammer API."""
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": False,
                    "balanceCents": 0,
                    "consumerId": "",
                    "toolId": "",
                    "keyId": "",
                },
            )
        )
        result1 = sg.validate_key(BUYER_KEY)
        result2 = sg.validate_key(BUYER_KEY)
        assert result1.valid is False
        assert result2.valid is False
        assert route.call_count == 1
        sg.close()

    def test_rejects_empty_buyer_key(self):
        sg = _make_sdk()
        with pytest.raises(InvalidKeyError):
            sg.validate_key("")
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_clear_cache_forces_refetch(self, respx_mock):
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": True,
                    "balanceCents": 100,
                    "consumerId": "c1",
                    "toolId": "t1",
                    "keyId": "k1",
                },
            ),
        )
        sg.validate_key(BUYER_KEY)
        assert sg.cache_size == 1
        sg.clear_cache()
        assert sg.cache_size == 0
        sg.validate_key(BUYER_KEY)
        assert route.call_count == 2
        sg.close()


# ─── validate_key async ─────────────────────────────────────────────────


class TestValidateKeyAsync:
    @respx.mock(base_url=API_URL)
    async def test_valid_key_round_trip(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": True,
                    "balanceCents": 5000,
                    "consumerId": "cA",
                    "toolId": "tA",
                    "keyId": "kA",
                },
            )
        )
        result = await sg.validate_key_async(BUYER_KEY)
        assert result.valid is True
        assert result.balance_cents == 5000
        await sg.aclose()

    @respx.mock(base_url=API_URL)
    async def test_caches_result(self, respx_mock):
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=Response(
                200,
                json={
                    "valid": True,
                    "balanceCents": 100,
                    "consumerId": "cA",
                    "toolId": "tA",
                    "keyId": "kA",
                },
            ),
        )
        await sg.validate_key_async(BUYER_KEY)
        await sg.validate_key_async(BUYER_KEY)
        assert route.call_count == 1
        await sg.aclose()

    async def test_rejects_empty_buyer_key(self):
        sg = _make_sdk()
        with pytest.raises(InvalidKeyError):
            await sg.validate_key_async("")
        await sg.aclose()


# ─── meter sync ─────────────────────────────────────────────────────────


class TestMeterSync:
    @respx.mock(base_url=API_URL)
    def test_meter_happy_path(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                    "invocationId": "inv_001",
                },
            )
        )
        result = sg.meter(
            BUYER_KEY,
            method="search",
            cost_cents=10,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        assert isinstance(result, MeterResult)
        assert result.success is True
        assert result.cost_cents == 10
        assert result.remaining_balance_cents == 4990
        assert result.invocation_id == "inv_001"
        sg.close()

    def test_rejects_empty_buyer_key(self):
        sg = _make_sdk()
        with pytest.raises(InvalidKeyError):
            sg.meter(
                "",
                method="search",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_rejects_negative_cost(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match=">= 0"):
            sg.meter(
                BUYER_KEY,
                method="search",
                cost_cents=-1,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_rejects_bool_cost(self):
        sg = _make_sdk()
        with pytest.raises(TypeError):
            sg.meter(
                BUYER_KEY,
                method="search",
                cost_cents=True,  # type: ignore[arg-type]
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_wire_body_contains_consumerId_toolId_keyId(self, respx_mock):
        # Phase-3 integration audit pin: the meter endpoint's Zod
        # schema (apps/web/src/app/api/sdk/meter/route.ts) marks
        # ``consumerId`` / ``toolId`` / ``keyId`` as required UUIDs.
        # Earlier versions of this client omitted them — every meter
        # call in production fails 400. This test captures the actual
        # POST body and asserts the IDs are forwarded with the
        # camelCase keys the TS endpoint validates against.
        import json

        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 0,
                    "costCents": 1,
                    "invocationId": "inv_wire",
                },
            )
        )
        sg.meter(
            BUYER_KEY,
            method="search",
            cost_cents=1,
            consumer_id="11111111-1111-1111-1111-111111111111",
            tool_id="22222222-2222-2222-2222-222222222222",
            key_id="33333333-3333-3333-3333-333333333333",
        )
        # Capture and inspect the actual request body the TS endpoint
        # would have received.
        captured = json.loads(route.calls.last.request.content)
        assert captured["toolSlug"] == "test-tool"
        assert captured["consumerId"] == "11111111-1111-1111-1111-111111111111"
        assert captured["toolId"] == "22222222-2222-2222-2222-222222222222"
        assert captured["keyId"] == "33333333-3333-3333-3333-333333333333"
        assert captured["method"] == "search"
        assert captured["costCents"] == 1
        # ``apiKey`` was previously sent on the wire; the meter endpoint
        # never accepted it. Pin it OUT of the wire shape so a future
        # regression to the old payload (which would still mock-pass on
        # the success-path test above) gets caught here.
        assert "apiKey" not in captured
        sg.close()


# ─── meter async ────────────────────────────────────────────────────────


class TestMeterAsync:
    @respx.mock(base_url=API_URL)
    async def test_meter_happy_path(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4975,
                    "costCents": 25,
                    "invocationId": "inv_async",
                },
            )
        )
        result = await sg.meter_async(
            BUYER_KEY,
            method="search",
            cost_cents=25,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        assert result.success is True
        assert result.cost_cents == 25
        assert result.remaining_balance_cents == 4975
        await sg.aclose()

    async def test_rejects_empty_method(self):
        sg = _make_sdk()
        with pytest.raises(ValueError, match="non-empty method"):
            await sg.meter_async(
                BUYER_KEY,
                method="",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        await sg.aclose()


# ─── wrap dispatch ──────────────────────────────────────────────────────


class TestWrap:
    def test_wrap_returns_wrapper(self):
        from settlegrid import Wrapper

        sg = _make_sdk()
        w = sg.wrap(meter="search", price_cents=10)
        assert isinstance(w, Wrapper)
        assert w.meter == "search"
        assert w.price_cents == 10
        sg.close()

    def test_wrap_with_buyer_key(self):
        sg = _make_sdk()
        w = sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        assert w.api_key == BUYER_KEY
        sg.close()


# ─── lifecycle ──────────────────────────────────────────────────────────


class TestLifecycle:
    def test_close_idempotent(self):
        sg = _make_sdk()
        sg.close()
        sg.close()  # should not raise

    async def test_aclose_idempotent(self):
        sg = _make_sdk()
        await sg.aclose()
        await sg.aclose()
