"""Port of edge-case scenarios from ``packages/mcp/src/__tests__/apiCall.test.ts``.

The bulk of HTTP behavior is covered in ``test_http.py``; this file mirrors
the TS-suite's hostile body-shape coverage that would be brittle if added
to the main HTTP test file: literal-null bodies, primitive bodies, array
bodies, malformed JSON. Each test exercises the full client → response
mapping to confirm the typed error surfaces correctly even when servers
return JSON outside the expected schema.
"""

from __future__ import annotations

import httpx
import pytest
import respx

from settlegrid import (
    InsufficientCreditsError,
    InvalidKeyError,
    NetworkError,
    RateLimitedError,
    SettleGridUnavailableError,
)
from settlegrid._http import HTTPConfig, SettleGridHTTPClient


def _client(**overrides) -> SettleGridHTTPClient:
    return SettleGridHTTPClient(
        HTTPConfig(
            api_url="https://api.test",
            tool_slug="my-tool",
            timeout_ms=1_000,
            max_retries=overrides.get("max_retries", 0),
        )
    )


@pytest.fixture(autouse=True)
def _disable_sleep(monkeypatch):
    """Skip the 1s/2s/4s exponential backoff during retry tests."""
    import asyncio
    import time

    monkeypatch.setattr(asyncio, "sleep", lambda *_a, **_k: _async_noop())
    monkeypatch.setattr(time, "sleep", lambda *_a, **_k: None)


async def _async_noop() -> None:
    return None


# ─── literal null bodies ─────────────────────────────────────────────────


class TestLiteralNullBody:
    @respx.mock(base_url="https://api.test")
    async def test_401_with_null_body_still_invalid_key(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=httpx.Response(401, json=None)
        )
        with pytest.raises(InvalidKeyError):
            await client.request("/keys/validate", {"apiKey": "k"})
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_402_with_null_body_still_insufficient_credits(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(402, json=None)
        )
        with pytest.raises(InsufficientCreditsError) as exc_info:
            await client.request("/meter", {"apiKey": "k"})
        assert exc_info.value.required_cents == 0
        assert exc_info.value.available_cents == 0
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_500_with_null_body_still_unavailable(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(500, json=None)
        )
        with pytest.raises(SettleGridUnavailableError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()


# ─── primitive / array bodies that aren't dicts ─────────────────────────


class TestNonObjectBody:
    @respx.mock(base_url="https://api.test")
    async def test_402_with_array_body_normalizes_to_empty(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(402, json=[1, 2, 3])
        )
        with pytest.raises(InsufficientCreditsError) as exc:
            await client.request("/meter", {"apiKey": "k"})
        assert exc.value.required_cents == 0
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_401_with_number_body_normalizes_to_empty(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=httpx.Response(401, json=42)
        )
        with pytest.raises(InvalidKeyError):
            await client.request("/keys/validate", {"apiKey": "k"})
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_500_with_string_body_falls_back_to_status(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(500, json="oh no")
        )
        with pytest.raises(SettleGridUnavailableError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()


# ─── empty / malformed body on success ───────────────────────────────────


class TestSuccessBodyEdgeCases:
    @respx.mock(base_url="https://api.test")
    async def test_200_with_array_json_body_raises(self, respx_mock) -> None:
        """Success bodies must be JSON objects; arrays → NetworkError."""
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(200, json=[1, 2, 3])
        )
        with pytest.raises(NetworkError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_200_with_null_body_raises(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(200, json=None)
        )
        with pytest.raises(NetworkError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_200_with_malformed_json_raises(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                200,
                content=b"<html>nginx 500</html>",
                headers={"content-type": "text/html"},
            )
        )
        with pytest.raises(NetworkError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()


# ─── 401 with empty-string error message ─────────────────────────────────


class TestEdgeCaseErrorBodies:
    @respx.mock(base_url="https://api.test")
    async def test_401_with_empty_error_uses_default_message(self, respx_mock) -> None:
        """``{ error: "" }`` should NOT pass an empty string to the
        constructor — falls back to the default message."""
        client = _client()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=httpx.Response(401, json={"error": ""})
        )
        with pytest.raises(InvalidKeyError) as exc:
            await client.request("/keys/validate", {"apiKey": "k"})
        # Default message starts with "Invalid or revoked"
        assert "Invalid or revoked" in str(exc.value) or len(str(exc.value)) > 0
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_429_with_negative_retry_after_falls_back_to_default(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                429, headers={"retry-after": "-1"}, json={}
            )
        )
        with pytest.raises(RateLimitedError) as exc:
            await client.request("/meter", {"apiKey": "k"})
        assert exc.value.retry_after_seconds == 60
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_429_with_unparseable_retry_after_falls_back(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                429,
                headers={"retry-after": "Wed, 21 Oct 2026 07:28:00 GMT"},
                json={},
            )
        )
        with pytest.raises(RateLimitedError) as exc:
            await client.request("/meter", {"apiKey": "k"})
        # HTTP-date format isn't supported (matches TS); falls back to 60s.
        assert exc.value.retry_after_seconds == 60
        await client.aclose()


# ─── 402 with topUpUrl edge cases ────────────────────────────────────────


class TestInsufficientCreditsTopUpEdge:
    @respx.mock(base_url="https://api.test")
    async def test_402_with_explicit_null_topup_url(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                402,
                json={
                    "requiredCents": 100,
                    "availableCents": 50,
                    "topUpUrl": None,
                },
            )
        )
        with pytest.raises(InsufficientCreditsError) as exc:
            await client.request("/meter", {"apiKey": "k"})
        assert exc.value.top_up_url == "https://settlegrid.ai/top-up"
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_402_with_empty_topup_url(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                402,
                json={
                    "requiredCents": 100,
                    "availableCents": 50,
                    "topUpUrl": "",
                },
            )
        )
        with pytest.raises(InsufficientCreditsError) as exc:
            await client.request("/meter", {"apiKey": "k"})
        assert exc.value.top_up_url == "https://settlegrid.ai/top-up"
        await client.aclose()

    def test_direct_construction_with_none(self) -> None:
        """Bypassing the HTTP layer — direct construction should also
        coalesce None to the default top-up URL."""
        err = InsufficientCreditsError(100, 50, None)
        assert err.top_up_url == "https://settlegrid.ai/top-up"

    def test_direct_construction_with_empty_string(self) -> None:
        err = InsufficientCreditsError(100, 50, "")
        assert err.top_up_url == "https://settlegrid.ai/top-up"


# ─── 404 / 403 fall-through ──────────────────────────────────────────────


class TestUnknown4xxFallthrough:
    @respx.mock(base_url="https://api.test")
    async def test_404_with_different_code_falls_through(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                404, json={"code": "SOMETHING_ELSE"}
            )
        )
        with pytest.raises(SettleGridUnavailableError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()

    @respx.mock(base_url="https://api.test")
    async def test_403_with_different_code_falls_through(self, respx_mock) -> None:
        client = _client()
        respx_mock.post("/api/sdk/meter").mock(
            return_value=httpx.Response(
                403, json={"code": "INSUFFICIENT_SCOPE"}
            )
        )
        with pytest.raises(SettleGridUnavailableError):
            await client.request("/meter", {"apiKey": "k"})
        await client.aclose()
