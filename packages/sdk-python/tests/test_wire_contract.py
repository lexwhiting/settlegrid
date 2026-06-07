"""Wire-contract tests against the REAL SettleGrid server shapes (F4).

Pins the Python SDK to the ACTUAL deployed wire contract:

- ``POST /api/sdk/validate-key`` — the real route. (The pre-F4 client called
  a phantom validate path that has never existed on the server; see the F4
  trace in ``docs/tech-debt/``.) Success carries ``isTestKey``; FAILURE is an
  HTTP-200
  ``{valid: false, reason}`` WITHOUT the id fields
  (``apps/web/src/app/api/sdk/validate-key/route.ts``).
- ``POST /api/sdk/meter`` under the F2 contract — the buyer key MUST ride the
  ``X-Api-Key`` header (``meter/route.ts:59-86``), and the server emits four
  distinct success shapes: zero-cost; test-mode (extra ``billed``/``reason``);
  the Redis fast path WITHOUT ``invocationId`` (+ ``isFlagged`` when flagged);
  DB fallback (+ ``isFlagged`` when flagged).

Every test in this file FAILS against the pre-F4 client (phantom path /
missing header / over-strict models) — the fail-pre-fix proof is recorded in
the F4 build log (``.audit/f4-build/``).
"""

from __future__ import annotations

import json

import pytest
import respx
from httpx import Response

from settlegrid import SDK_VERSION, InvalidKeyError, SettleGrid

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


def _success_validate_body(*, is_test_key: bool = False, balance: int = 5000) -> dict:
    """The REAL validate-key success shape (route.ts:115-123 / :146-153)."""
    return {
        "valid": True,
        "consumerId": "c1",
        "toolId": "t1",
        "keyId": "k1",
        "balanceCents": balance,
        "isTestKey": is_test_key,
    }


def _failure_validate_body(reason: str = "Invalid API key.") -> dict:
    """The REAL validate-key failure shape — HTTP 200, no id fields (route.ts:63 etc.)."""
    return {"valid": False, "reason": reason}


# ─── meter: X-Api-Key header (the F2 contract) ───────────────────────────


class TestMeterSendsApiKeyHeader:
    @respx.mock(base_url=API_URL)
    def test_meter_sync_sends_x_api_key_header(self, respx_mock):
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                    "invocationId": "inv_1",
                },
            )
        )
        sg.meter(
            BUYER_KEY,
            method="search",
            cost_cents=10,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        sent = route.calls.last.request.headers
        assert sent.get("x-api-key") == BUYER_KEY
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_meter_async_sends_x_api_key_header(self, respx_mock):
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                    "invocationId": "inv_1",
                },
            )
        )
        await sg.meter_async(
            BUYER_KEY,
            method="search",
            cost_cents=10,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        sent = route.calls.last.request.headers
        assert sent.get("x-api-key") == BUYER_KEY
        await sg.aclose()

    @respx.mock(base_url=API_URL)
    def test_meter_header_merge_preserves_client_headers(self, respx_mock):
        """Per-request X-Api-Key MERGES with (not replaces) client-level headers."""
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                    "invocationId": "inv_1",
                },
            )
        )
        sg.meter(
            BUYER_KEY,
            method="search",
            cost_cents=10,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        sent = route.calls.last.request.headers
        assert sent.get("x-api-key") == BUYER_KEY
        assert sent.get("user-agent") == f"settlegrid-python/{SDK_VERSION}"
        assert sent.get("content-type") == "application/json"
        sg.close()


# ─── validate-key: the REAL route + success shapes ───────────────────────


class TestValidateKeyRealSuccessShape:
    @respx.mock(base_url=API_URL)
    def test_parses_success_with_is_test_key_false(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_success_validate_body())
        )
        result = sg.validate_key(BUYER_KEY)
        assert result.valid is True
        assert result.consumer_id == "c1"
        assert result.tool_id == "t1"
        assert result.key_id == "k1"
        assert result.balance_cents == 5000
        assert result.is_test_key is False
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_parses_test_key_success_with_unlimited_balance(self, respx_mock):
        """Test keys return isTestKey=true + the 999999 virtual balance."""
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(
                200, json=_success_validate_body(is_test_key=True, balance=999999)
            )
        )
        result = sg.validate_key(BUYER_KEY)
        assert result.valid is True
        assert result.is_test_key is True
        assert result.balance_cents == 999999
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_parses_success_async(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_success_validate_body())
        )
        result = await sg.validate_key_async(BUYER_KEY)
        assert result.valid is True
        assert result.is_test_key is False
        await sg.aclose()

    @respx.mock(base_url=API_URL)
    def test_request_body_is_apikey_and_toolslug_on_real_path(self, respx_mock):
        """The body shape {apiKey, toolSlug} is unchanged — only the path moved."""
        sg = _make_sdk()
        route = respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_success_validate_body())
        )
        sg.validate_key(BUYER_KEY)
        sent = json.loads(route.calls.last.request.content)
        assert sent == {"apiKey": BUYER_KEY, "toolSlug": "test-tool"}
        sg.close()


# ─── validate-key: the REAL failure shape (HTTP 200) ─────────────────────


class TestValidateKeyRealFailureShape:
    @respx.mock(base_url=API_URL)
    def test_parses_failure_shape_with_reason_and_no_ids(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_failure_validate_body())
        )
        result = sg.validate_key(BUYER_KEY)
        assert result.valid is False
        assert result.reason == "Invalid API key."
        assert result.consumer_id is None
        assert result.tool_id is None
        assert result.key_id is None
        assert result.balance_cents is None
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_parses_failure_shape_async(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(
                200, json=_failure_validate_body("API key has been revoked.")
            )
        )
        result = await sg.validate_key_async(BUYER_KEY)
        assert result.valid is False
        assert result.reason == "API key has been revoked."
        await sg.aclose()


# ─── wrap pipeline against the real failure / malformed shapes ───────────


class TestWrapOnRealValidateShapes:
    @respx.mock(base_url=API_URL)
    def test_decorator_raises_invalid_key_on_failure_shape(self, respx_mock):
        """The real {valid:false, reason} body → typed InvalidKeyError, handler never runs."""
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_failure_validate_body())
        )
        calls: list[int] = []

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        def tool() -> str:
            calls.append(1)
            return "x"

        with pytest.raises(InvalidKeyError):
            tool()
        assert calls == []
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_context_manager_raises_invalid_key_on_failure_shape(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json=_failure_validate_body())
        )
        with (
            pytest.raises(InvalidKeyError),
            sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY),
        ):
            pass  # pragma: no cover — never entered
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_decorator_raises_invalid_key_on_malformed_success_without_ids(
        self, respx_mock
    ):
        """A valid=True body MISSING the id fields must raise typed InvalidKeyError
        (never feed None ids into the meter call)."""
        sg = _make_sdk()
        respx_mock.post("/api/sdk/validate-key").mock(
            return_value=Response(200, json={"valid": True, "balanceCents": 5000})
        )
        calls: list[int] = []

        @sg.wrap(meter="search", price_cents=10, api_key=BUYER_KEY)
        def tool() -> str:
            calls.append(1)
            return "x"

        with pytest.raises(InvalidKeyError):
            tool()
        assert calls == []
        sg.close()


# ─── meter: the four REAL success shapes ─────────────────────────────────


class TestMeterRealSuccessShapes:
    @respx.mock(base_url=API_URL)
    def test_parses_redis_fast_path_without_invocation_id(self, respx_mock):
        """The PRIMARY production path (meter/route.ts:324-329) omits invocationId."""
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
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
        assert result.success is True
        assert result.remaining_balance_cents == 4990
        assert result.invocation_id is None
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_parses_redis_fast_path_async(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                },
            )
        )
        result = await sg.meter_async(
            BUYER_KEY,
            method="search",
            cost_cents=10,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        assert result.success is True
        assert result.invocation_id is None
        await sg.aclose()

    @respx.mock(base_url=API_URL)
    def test_parses_flagged_fast_path(self, respx_mock):
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 4990,
                    "costCents": 10,
                    "isFlagged": True,
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
        assert result.success is True
        assert result.is_flagged is True
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_parses_test_mode_shape_with_billed_and_reason(self, respx_mock):
        """Test-mode responses (meter/route.ts:181-188) add billed/reason."""
        sg = _make_sdk()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=Response(
                200,
                json={
                    "success": True,
                    "remainingBalanceCents": 999999,
                    "costCents": 0,
                    "invocationId": "inv_1",
                    "billed": False,
                    "reason": "TEST_MODE",
                },
            )
        )
        result = sg.meter(
            BUYER_KEY,
            method="search",
            cost_cents=0,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
        )
        assert result.success is True
        assert result.billed is False
        assert result.reason == "TEST_MODE"
        assert result.invocation_id == "inv_1"
        sg.close()


# ─── _require_ids helper (unit) ──────────────────────────────────────────


class TestRequireIdsHelper:
    def test_returns_id_triple_when_all_present(self):
        from settlegrid import KeyValidationResult
        from settlegrid.wrap import _require_ids

        validation = KeyValidationResult(
            valid=True,
            consumer_id="c1",
            tool_id="t1",
            key_id="k1",
            balance_cents=100,
        )
        assert _require_ids(validation) == ("c1", "t1", "k1")

    def test_raises_invalid_key_when_any_id_missing(self):
        from settlegrid import KeyValidationResult
        from settlegrid.wrap import _require_ids

        validation = KeyValidationResult(valid=True, balance_cents=100)
        with pytest.raises(InvalidKeyError):
            _require_ids(validation)
