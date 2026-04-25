"""Coverage tests for ``settlegrid._http``.

Uses :mod:`respx` to stub the httpx transport, exercising every status-code
branch, the retry/backoff loop, the circuit breaker, and the
``Retry-After`` resolution precedence end-to-end.
"""

from __future__ import annotations

import time

import httpx
import pytest
import respx

from settlegrid import (
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
from settlegrid._http import (
    DEFAULT_RETRY_AFTER_SECONDS,
    CircuitBreaker,
    HTTPConfig,
    SettleGridHTTPClient,
    _map_status_to_error,
    _parse_error_body,
    _parse_success_body,
    _resolve_retry_after_seconds,
)
from settlegrid._types import APIErrorBody

# ─── CircuitBreaker ─────────────────────────────────────────────────────


class TestCircuitBreaker:
    def test_starts_closed(self) -> None:
        cb = CircuitBreaker(threshold=3, cooldown_ms=1000)
        assert cb.can_execute() is True

    def test_opens_after_threshold_failures(self) -> None:
        cb = CircuitBreaker(threshold=3, cooldown_ms=10_000)
        cb.record_failure()
        cb.record_failure()
        assert cb.can_execute() is True
        cb.record_failure()
        assert cb.can_execute() is False

    def test_record_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(threshold=3, cooldown_ms=10_000)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        # Two more failures should not yet trip — counter is back at zero.
        cb.record_failure()
        cb.record_failure()
        assert cb.can_execute() is True

    def test_reopens_after_cooldown(self) -> None:
        cb = CircuitBreaker(threshold=1, cooldown_ms=10)  # 10ms cooldown
        cb.record_failure()
        assert cb.can_execute() is False
        time.sleep(0.02)  # 20ms — past the cooldown
        assert cb.can_execute() is True

    @pytest.mark.parametrize("threshold", [0, -1])
    def test_rejects_bad_threshold(self, threshold: int) -> None:
        with pytest.raises(ValueError):
            CircuitBreaker(threshold=threshold, cooldown_ms=1000)

    def test_rejects_negative_cooldown(self) -> None:
        with pytest.raises(ValueError):
            CircuitBreaker(threshold=1, cooldown_ms=-1)


# ─── _resolve_retry_after_seconds ────────────────────────────────────────


class TestResolveRetryAfter:
    def test_default_60_when_neither_set(self) -> None:
        assert (
            _resolve_retry_after_seconds({}, APIErrorBody())
            == DEFAULT_RETRY_AFTER_SECONDS
        )

    def test_header_takes_precedence(self) -> None:
        assert (
            _resolve_retry_after_seconds(
                {"retry-after": "15"},
                APIErrorBody(retryAfterSeconds=30),
            )
            == 15
        )

    def test_body_used_when_no_header(self) -> None:
        assert (
            _resolve_retry_after_seconds({}, APIErrorBody(retryAfterSeconds=30))
            == 30
        )

    @pytest.mark.parametrize("bad_header", ["-1", "abc", "Wed, 21 Oct 2026 07:28:00 GMT"])
    def test_negative_or_malformed_header_falls_through(self, bad_header: str) -> None:
        assert (
            _resolve_retry_after_seconds(
                {"retry-after": bad_header}, APIErrorBody()
            )
            == DEFAULT_RETRY_AFTER_SECONDS
        )

    def test_negative_body_field_falls_through_to_default(self) -> None:
        # Pydantic accepts negative ints; resolver guards.
        body = APIErrorBody(retryAfterSeconds=-5)
        assert (
            _resolve_retry_after_seconds({}, body)
            == DEFAULT_RETRY_AFTER_SECONDS
        )

    def test_zero_body_field_is_honored(self) -> None:
        # 0 is a valid (immediate) retry-after; the resolver does NOT
        # treat it as a sentinel for "missing".
        body = APIErrorBody(retryAfterSeconds=0)
        assert _resolve_retry_after_seconds({}, body) == 0


# ─── _map_status_to_error ────────────────────────────────────────────────


class TestMapStatusToError:
    def _map(
        self,
        status: int,
        body: APIErrorBody | None = None,
        *,
        tool_slug: str = "my-tool",
        headers: dict[str, str] | None = None,
    ) -> SettleGridError:
        return _map_status_to_error(
            status,
            body or APIErrorBody(),
            tool_slug=tool_slug,
            response_headers=headers or {},
        )

    def test_401_invalid_key_default_message(self) -> None:
        err = self._map(401)
        assert isinstance(err, InvalidKeyError)
        assert err.code == "INVALID_KEY"
        assert err.status_code == 401

    def test_401_uses_body_error_when_provided(self) -> None:
        err = self._map(401, APIErrorBody(error="key revoked"))
        assert isinstance(err, InvalidKeyError)
        assert "key revoked" in str(err)

    def test_402_insufficient_credits(self) -> None:
        err = self._map(
            402,
            APIErrorBody(
                requiredCents=100,
                availableCents=50,
                topUpUrl="https://example.com/topup",
            ),
        )
        assert isinstance(err, InsufficientCreditsError)
        assert err.required_cents == 100
        assert err.available_cents == 50
        assert err.top_up_url == "https://example.com/topup"

    def test_402_with_missing_amounts_defaults_to_zero(self) -> None:
        err = self._map(402)
        assert isinstance(err, InsufficientCreditsError)
        assert err.required_cents == 0
        assert err.available_cents == 0

    def test_403_with_tool_disabled_code(self) -> None:
        err = self._map(403, APIErrorBody(code="TOOL_DISABLED"))
        assert isinstance(err, ToolDisabledError)
        assert err.code == "TOOL_DISABLED"
        assert "my-tool" in str(err)

    def test_403_without_tool_disabled_code_is_unavailable(self) -> None:
        err = self._map(403, APIErrorBody(error="forbidden"))
        assert isinstance(err, SettleGridUnavailableError)
        assert "forbidden" in str(err)

    def test_404_with_tool_not_found_code(self) -> None:
        err = self._map(404, APIErrorBody(code="TOOL_NOT_FOUND"))
        assert isinstance(err, ToolNotFoundError)

    def test_404_without_code_is_unavailable(self) -> None:
        err = self._map(404)
        assert isinstance(err, SettleGridUnavailableError)
        assert "404" in str(err)

    def test_429_with_header_uses_header(self) -> None:
        err = self._map(429, headers={"retry-after": "12"})
        assert isinstance(err, RateLimitedError)
        assert err.retry_after_seconds == 12

    def test_429_with_no_signals_defaults_to_60s(self) -> None:
        err = self._map(429)
        assert isinstance(err, RateLimitedError)
        assert err.retry_after_seconds == DEFAULT_RETRY_AFTER_SECONDS

    @pytest.mark.parametrize("status", [500, 502, 503, 504, 599])
    def test_5xx_is_unavailable(self, status: int) -> None:
        err = self._map(status)
        assert isinstance(err, SettleGridUnavailableError)
        assert str(status) in str(err)

    def test_unexpected_4xx_is_unavailable(self) -> None:
        # 422 is not in the explicit switch — falls through to the
        # SettleGridUnavailableError default (matches TS).
        err = self._map(422, APIErrorBody(error="schema bad"))
        assert isinstance(err, SettleGridUnavailableError)
        assert "schema bad" in str(err)


# ─── _parse_error_body / _parse_success_body ────────────────────────────


class TestErrorBodyParsing:
    def test_parses_dict_into_api_error_body(self) -> None:
        body = _parse_error_body({"error": "bad", "code": "X"})
        assert body.error == "bad"
        assert body.code == "X"

    def test_returns_empty_for_non_dict(self) -> None:
        body = _parse_error_body([1, 2, 3])
        assert body.error is None
        assert body.code is None

    def test_returns_empty_for_none(self) -> None:
        assert _parse_error_body(None).error is None

    def test_swallows_validation_errors(self) -> None:
        # APIErrorBody declares retry_after_seconds: int | None — a
        # non-coerceable shape should still produce an empty-ish body
        # rather than raising.
        body = _parse_error_body({"retryAfterSeconds": object()})
        # extra="ignore" + strict=False on APIErrorBody means weird
        # shapes either coerce or are dropped — never raise.
        assert isinstance(body, APIErrorBody)


class TestSuccessBodyParsing:
    def test_parses_dict(self) -> None:
        response = httpx.Response(200, json={"a": 1})
        assert _parse_success_body(response) == {"a": 1}

    def test_raises_on_non_json(self) -> None:
        response = httpx.Response(200, content=b"<html>plain</html>")
        with pytest.raises(NetworkError):
            _parse_success_body(response)

    def test_raises_on_non_object_json(self) -> None:
        response = httpx.Response(200, json=[1, 2, 3])
        with pytest.raises(NetworkError):
            _parse_success_body(response)


# ─── SettleGridHTTPClient — config validation ────────────────────────────


class TestHTTPClientConfig:
    def test_rejects_zero_timeout(self) -> None:
        with pytest.raises(ValueError):
            SettleGridHTTPClient(HTTPConfig(timeout_ms=0, tool_slug="t"))

    def test_rejects_excessive_timeout(self) -> None:
        with pytest.raises(ValueError):
            SettleGridHTTPClient(HTTPConfig(timeout_ms=999_999, tool_slug="t"))

    def test_rejects_negative_max_retries(self) -> None:
        with pytest.raises(ValueError):
            SettleGridHTTPClient(HTTPConfig(max_retries=-1, tool_slug="t"))

    def test_close_idempotent(self) -> None:
        client = SettleGridHTTPClient(HTTPConfig(tool_slug="t"))
        client.close()
        client.close()  # second call is a no-op

    @pytest.mark.asyncio
    async def test_aclose_idempotent(self) -> None:
        client = SettleGridHTTPClient(HTTPConfig(tool_slug="t"))
        await client.aclose()
        await client.aclose()  # no error


# ─── SettleGridHTTPClient — request (async) ──────────────────────────────


@pytest.fixture
def http_client() -> SettleGridHTTPClient:
    return SettleGridHTTPClient(
        HTTPConfig(
            api_url="https://api.test",
            tool_slug="my-tool",
            timeout_ms=1_000,
            max_retries=2,
            circuit_breaker_threshold=3,
        )
    )


class TestRequestAsync:
    @pytest.mark.asyncio
    async def test_success_returns_dict(self, http_client: SettleGridHTTPClient) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "valid": True,
                        "consumerId": "c",
                        "toolId": "t",
                        "keyId": "k",
                        "balanceCents": 100,
                    },
                )
            )
            body = await http_client.request("/keys/validate", {"apiKey": "k"})
            assert body["consumerId"] == "c"
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_401_maps_to_invalid_key(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                return_value=httpx.Response(
                    401, json={"error": "bad key", "code": "INVALID_KEY"}
                )
            )
            with pytest.raises(InvalidKeyError):
                await http_client.request("/keys/validate", {"apiKey": "k"})
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_402_maps_to_insufficient_credits(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/meter").mock(
                return_value=httpx.Response(
                    402,
                    json={
                        "code": "INSUFFICIENT_CREDITS",
                        "requiredCents": 50,
                        "availableCents": 10,
                    },
                )
            )
            with pytest.raises(InsufficientCreditsError) as exc_info:
                await http_client.request(
                    "/meter", {"apiKey": "k", "method": "x", "costCents": 50}
                )
            assert exc_info.value.required_cents == 50
            assert exc_info.value.available_cents == 10
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_429_uses_header_retry_after(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/meter").mock(
                return_value=httpx.Response(
                    429,
                    headers={"retry-after": "7"},
                    json={"error": "slow down"},
                )
            )
            with pytest.raises(RateLimitedError) as exc_info:
                await http_client.request(
                    "/meter", {"apiKey": "k", "method": "x", "costCents": 1}
                )
            assert exc_info.value.retry_after_seconds == 7
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_5xx_retries_then_succeeds(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        # Patch backoff to zero so the test runs fast.
        with respx.mock(base_url="https://api.test") as router:
            route = router.post("/api/sdk/meter").mock(
                side_effect=[
                    httpx.Response(503),
                    httpx.Response(503),
                    httpx.Response(
                        200,
                        json={
                            "success": True,
                            "remainingBalanceCents": 90,
                            "costCents": 10,
                            "invocationId": "i_1",
                        },
                    ),
                ]
            )
            # Use a short backoff via a custom subclass would be cleaner,
            # but the default 1s/2s/4s schedule is too slow for tests.
            # Instead, monkeypatch asyncio.sleep so the loop doesn't wait.
            import asyncio
            original_sleep = asyncio.sleep

            async def fake_sleep(_: float) -> None:
                await original_sleep(0)

            asyncio.sleep = fake_sleep  # type: ignore[assignment]
            try:
                body = await http_client.request(
                    "/meter", {"apiKey": "k", "method": "x", "costCents": 10}
                )
                assert body["success"] is True
                assert route.call_count == 3
            finally:
                asyncio.sleep = original_sleep  # type: ignore[assignment]
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_5xx_exhausts_retries_then_raises(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        import asyncio
        original_sleep = asyncio.sleep

        async def fake_sleep(_: float) -> None:
            await original_sleep(0)

        asyncio.sleep = fake_sleep  # type: ignore[assignment]
        try:
            with respx.mock(base_url="https://api.test") as router:
                router.post("/api/sdk/meter").mock(
                    return_value=httpx.Response(503, json={"error": "down"})
                )
                with pytest.raises(SettleGridUnavailableError):
                    await http_client.request(
                        "/meter",
                        {"apiKey": "k", "method": "x", "costCents": 1},
                    )
        finally:
            asyncio.sleep = original_sleep  # type: ignore[assignment]
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_timeout_maps_to_timeout_error(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/meter").mock(
                side_effect=httpx.ConnectTimeout("simulated timeout")
            )
            with pytest.raises(SgTimeoutError):
                await http_client.request("/meter", {"apiKey": "k"})
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_connection_error_maps_to_network_error(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/meter").mock(
                side_effect=httpx.ConnectError("no route to host")
            )
            with pytest.raises(NetworkError) as exc_info:
                await http_client.request("/meter", {"apiKey": "k"})
            assert "no route to host" in str(exc_info.value)
        await http_client.aclose()

    @pytest.mark.asyncio
    async def test_circuit_breaker_open_blocks_request(
        self, http_client: SettleGridHTTPClient
    ) -> None:
        # Trip the breaker manually.
        for _ in range(http_client.config.circuit_breaker_threshold):
            http_client._circuit.record_failure()
        with pytest.raises(SettleGridUnavailableError) as exc_info:
            await http_client.request("/meter", {"apiKey": "k"})
        assert "Circuit breaker is open" in str(exc_info.value)
        await http_client.aclose()


# ─── SettleGridHTTPClient — request_sync ─────────────────────────────────


class TestRequestSync:
    def _client(self) -> SettleGridHTTPClient:
        return SettleGridHTTPClient(
            HTTPConfig(
                api_url="https://api.test",
                tool_slug="my-tool",
                timeout_ms=1_000,
                max_retries=2,
            )
        )

    def test_success_returns_dict(self) -> None:
        client = self._client()
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "valid": True,
                        "consumerId": "c",
                        "toolId": "t",
                        "keyId": "k",
                        "balanceCents": 100,
                    },
                )
            )
            body = client.request_sync("/keys/validate", {"apiKey": "k"})
            assert body["valid"] is True
        client.close()

    def test_401_maps_to_invalid_key(self) -> None:
        client = self._client()
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                return_value=httpx.Response(401, json={"error": "no"})
            )
            with pytest.raises(InvalidKeyError):
                client.request_sync("/keys/validate", {"apiKey": "k"})
        client.close()

    def test_5xx_retries(self) -> None:
        client = self._client()
        original_sleep = time.sleep
        time.sleep = lambda _: None  # type: ignore[assignment]
        try:
            with respx.mock(base_url="https://api.test") as router:
                route = router.post("/api/sdk/meter").mock(
                    side_effect=[
                        httpx.Response(500),
                        httpx.Response(
                            200,
                            json={
                                "success": True,
                                "remainingBalanceCents": 1,
                                "costCents": 1,
                                "invocationId": "i",
                            },
                        ),
                    ]
                )
                client.request_sync("/meter", {"apiKey": "k"})
                assert route.call_count == 2
        finally:
            time.sleep = original_sleep  # type: ignore[assignment]
        client.close()

    def test_timeout_maps_to_timeout_error(self) -> None:
        client = self._client()
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/meter").mock(
                side_effect=httpx.ConnectTimeout("oops")
            )
            with pytest.raises(SgTimeoutError):
                client.request_sync("/meter", {"apiKey": "k"})
        client.close()

    def test_circuit_breaker_open_blocks_request(self) -> None:
        client = self._client()
        for _ in range(client.config.circuit_breaker_threshold):
            client._circuit.record_failure()
        with pytest.raises(SettleGridUnavailableError):
            client.request_sync("/meter", {"apiKey": "k"})
        client.close()

    def test_connection_error_maps_to_network_error(self) -> None:
        """Sync RequestError path — covers _do_attempt_sync exc handler."""
        client = SettleGridHTTPClient(
            HTTPConfig(
                api_url="https://api.test",
                tool_slug="my-tool",
                timeout_ms=1_000,
                max_retries=0,
            )
        )
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                side_effect=httpx.ConnectError("dns failed")
            )
            with pytest.raises(NetworkError):
                client.request_sync("/keys/validate", {"apiKey": "k"})
        client.close()

    def test_non_json_error_body_falls_back(self) -> None:
        """Non-JSON 4xx body → ValueError on .json() → raw=None branch."""
        client = SettleGridHTTPClient(
            HTTPConfig(
                api_url="https://api.test",
                tool_slug="my-tool",
                timeout_ms=1_000,
                max_retries=0,
            )
        )
        with respx.mock(base_url="https://api.test") as router:
            router.post("/api/sdk/keys/validate").mock(
                return_value=httpx.Response(
                    400,
                    content=b"<html>nginx 400</html>",
                    headers={"content-type": "text/html"},
                )
            )
            with pytest.raises(SettleGridUnavailableError):
                client.request_sync("/keys/validate", {"apiKey": "k"})
        client.close()
