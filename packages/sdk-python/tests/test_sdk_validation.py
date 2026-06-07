"""Port of ``packages/mcp/src/__tests__/sdk-validation.test.ts``.

Verifies that the SDK rejects malformed input at the API boundary with
actionable error messages, and that valid inputs round-trip cleanly.
The TS tests focus on TS-specific concepts (toolSlug+pricing config) that
don't apply to Python's `meter(api_key, *, method, cost_cents)` shape, so
this port covers the equivalent Python validation surface area.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from settlegrid import (
    InvalidKeyError,
    KeyValidationResult,
    MeterRequest,
    MeterResult,
    SettleGrid,
    ValidateKeyRequest,
)

API_URL = "https://api.test"
SELLER_KEY = "sg_live_seller_key"
BUYER_KEY = "sg_live_buyer_key"


def _sdk(**kwargs: object) -> SettleGrid:
    return SettleGrid(
        api_key=SELLER_KEY,
        tool_slug="test-tool",
        api_url=API_URL,
        **kwargs,  # type: ignore[arg-type]
    )


def _validate_response() -> Response:
    return Response(
        200,
        json={
            "valid": True,
            "balanceCents": 5000,
            "consumerId": "c",
            "toolId": "t",
            "keyId": "k",
        },
    )


def _meter_response() -> Response:
    return Response(
        200,
        json={
            "success": True,
            "remainingBalanceCents": 4990,
            "costCents": 10,
            "invocationId": "i",
        },
    )


# ─── version ─────────────────────────────────────────────────────────────


class TestVersion:
    def test_exposes_sdk_version_string(self) -> None:
        from settlegrid import SDK_VERSION

        assert isinstance(SDK_VERSION, str)
        assert len(SDK_VERSION) > 0

    def test_dunder_version_matches_sdk_version(self) -> None:
        from settlegrid import SDK_VERSION, __version__

        assert __version__ == SDK_VERSION


# ─── SettleGrid() construction validation ────────────────────────────────


class TestSettleGridInit:
    def test_throws_when_api_key_empty(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key="")

    def test_throws_when_api_key_whitespace(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key="   \t\n  ")

    def test_throws_when_api_key_not_string(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key=42)  # type: ignore[arg-type]

    def test_throws_when_api_key_none(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            SettleGrid(api_key=None)  # type: ignore[arg-type]

    def test_error_message_mentions_keys_url(self) -> None:
        with pytest.raises(ValueError, match="settlegrid.ai/keys"):
            SettleGrid(api_key="")

    def test_succeeds_with_valid_minimal_config(self) -> None:
        sg = SettleGrid(api_key=SELLER_KEY)
        assert sg.api_key == SELLER_KEY
        assert sg.tool_slug == ""  # default
        sg.close()

    def test_accepts_custom_api_url(self) -> None:
        sg = SettleGrid(api_key=SELLER_KEY, api_url="https://staging.test")
        assert sg._http.config.api_url == "https://staging.test"
        sg.close()


# ─── sg.wrap() input validation ──────────────────────────────────────────


class TestWrapValidation:
    def test_throws_when_handler_is_not_callable(self) -> None:
        sg = _sdk()
        w = sg.wrap(meter="m", price_cents=10)
        with pytest.raises(TypeError, match="callable"):
            w(42)  # type: ignore[arg-type]
        sg.close()

    def test_throws_when_handler_is_none(self) -> None:
        sg = _sdk()
        w = sg.wrap(meter="m", price_cents=10)
        with pytest.raises(TypeError, match="callable"):
            w(None)  # type: ignore[arg-type]
        sg.close()

    def test_includes_received_type_in_error(self) -> None:
        sg = _sdk()
        w = sg.wrap(meter="m", price_cents=10)
        with pytest.raises(TypeError, match="int"):
            w(42)  # type: ignore[arg-type]
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_succeeds_with_valid_sync_handler(self, respx_mock) -> None:
        # H17 hostile fix — assert BOTH mocks were called exactly once.
        # Without `route.called` checks, the test would pass even if
        # metering silently broke (handler returned "ok" without charge).
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/validate-key").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @sg.wrap(meter="m", price_cents=10, api_key=BUYER_KEY)
        def handler() -> str:
            return "ok"

        assert handler() == "ok"
        assert validate_route.call_count == 1, (
            "wrap decorator must validate the buyer key once"
        )
        assert meter_route.call_count == 1, (
            "wrap decorator must meter exactly once on success"
        )
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_succeeds_with_valid_async_handler(self, respx_mock) -> None:
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/validate-key").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @sg.wrap(meter="m", price_cents=10, api_key=BUYER_KEY)
        async def handler() -> str:
            return "ok"

        assert await handler() == "ok"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        await sg.aclose()


# ─── sg.validate_key() input validation ──────────────────────────────────


class TestValidateKeyValidation:
    def test_throws_when_key_empty(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError, match="non-empty"):
            sg.validate_key("")
        sg.close()

    def test_throws_when_key_whitespace(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError, match="non-empty"):
            sg.validate_key("   \t\n  ")
        sg.close()

    async def test_async_throws_when_key_empty(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError):
            await sg.validate_key_async("")
        await sg.aclose()

    def test_error_message_includes_received_repr(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError, match="''"):
            sg.validate_key("")
        sg.close()


# ─── sg.meter() input validation ─────────────────────────────────────────


class TestMeterValidation:
    def test_throws_when_key_empty(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError):
            sg.meter(
                "",
                method="m",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_key_whitespace(self) -> None:
        sg = _sdk()
        with pytest.raises(InvalidKeyError):
            sg.meter(
                "   ",
                method="m",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_method_empty(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match="non-empty method"):
            sg.meter(
                BUYER_KEY,
                method="",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_method_whitespace(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match="non-empty method"):
            sg.meter(
                BUYER_KEY,
                method="   ",
                cost_cents=10,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_cost_negative(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match=">= 0"):
            sg.meter(
                BUYER_KEY,
                method="m",
                cost_cents=-1,
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_cost_is_float(self) -> None:
        sg = _sdk()
        with pytest.raises(TypeError):
            sg.meter(
                BUYER_KEY,
                method="m",
                cost_cents=1.5,  # type: ignore[arg-type]
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()

    def test_throws_when_cost_is_bool(self) -> None:
        """``bool`` is an int subclass — guard rejects it."""
        sg = _sdk()
        with pytest.raises(TypeError):
            sg.meter(
                BUYER_KEY,
                method="m",
                cost_cents=True,  # type: ignore[arg-type]
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
            )
        sg.close()


# ─── request body shape — wire format round-trip ─────────────────────────


class TestRequestBodyShapes:
    def test_validate_key_request_round_trip(self) -> None:
        body = ValidateKeyRequest(api_key=BUYER_KEY, tool_slug="my-tool")
        emitted = body.model_dump(by_alias=True)
        assert emitted == {"apiKey": BUYER_KEY, "toolSlug": "my-tool"}

    def test_meter_request_round_trip_minimal(self) -> None:
        body = MeterRequest(
            tool_slug="my-tool",
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
            method="search",
            cost_cents=10,
        )
        emitted = body.model_dump(by_alias=True, exclude_none=True)
        assert emitted == {
            "toolSlug": "my-tool",
            "consumerId": "c1",
            "toolId": "t1",
            "keyId": "k1",
            "method": "search",
            "costCents": 10,
        }

    def test_meter_request_includes_units_when_set(self) -> None:
        body = MeterRequest(
            tool_slug="my-tool",
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
            method="search",
            cost_cents=10,
            units=5,
        )
        emitted = body.model_dump(by_alias=True, exclude_none=True)
        assert emitted["units"] == 5

    def test_meter_request_omits_units_when_unset(self) -> None:
        body = MeterRequest(
            tool_slug="my-tool",
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
            method="search",
            cost_cents=10,
        )
        emitted = body.model_dump(by_alias=True, exclude_none=True)
        assert "units" not in emitted

    def test_meter_request_rejects_apikey_field(self) -> None:
        # apiKey is NOT part of the meter endpoint's wire schema. The
        # Python model uses ``extra="forbid"``, so passing apiKey would
        # raise a ValidationError. This pins that the field stays out
        # of the wire shape — preventing a regression to the old pre-
        # Phase-3-audit shape that included it.
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            MeterRequest(
                api_key=BUYER_KEY,  # type: ignore[call-arg]
                tool_slug="my-tool",
                consumer_id="c1",
                tool_id="t1",
                key_id="k1",
                method="search",
                cost_cents=10,
            )


# ─── response body shape — wire format round-trip ────────────────────────


class TestResponseBodyShapes:
    def test_key_validation_result_round_trip(self) -> None:
        wire = {
            "valid": True,
            "consumerId": "c",
            "toolId": "t",
            "keyId": "k",
            "balanceCents": 5000,
        }
        result = KeyValidationResult.model_validate(wire)
        assert result.valid is True
        assert result.consumer_id == "c"
        assert result.tool_id == "t"
        assert result.key_id == "k"
        assert result.balance_cents == 5000
        assert result.model_dump(by_alias=True, exclude_none=True) == wire

    def test_meter_result_round_trip(self) -> None:
        wire = {
            "success": True,
            "remainingBalanceCents": 4990,
            "costCents": 10,
            "invocationId": "inv_123",
        }
        result = MeterResult.model_validate(wire)
        assert result.success is True
        assert result.remaining_balance_cents == 4990
        assert result.cost_cents == 10
        assert result.invocation_id == "inv_123"
        assert result.model_dump(by_alias=True, exclude_none=True) == wire
