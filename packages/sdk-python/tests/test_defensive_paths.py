"""Coverage for the last few defensive code paths.

These branches are practically unreachable in normal operation:
- ``Wrapper._meter_or_void_*`` early-returns when ``_invocation`` is None
  or ``api_key`` is None (both validated at construction).
- ``SettleGridHTTPClient.request[_sync]`` defensive post-loop raise that
  only fires if every attempt returns ``retry=True`` (not possible via
  the real ``_handle_response`` because the last attempt always falls
  through to error mapping).

Covering them requires direct method invocation or monkeypatched
internals. The tests document that these are belt-and-suspenders, not
a primary control flow.
"""

from __future__ import annotations

import asyncio

import pytest

from settlegrid import (
    Invocation,
    SettleGrid,
    SettleGridUnavailableError,
)
from settlegrid._http import (
    HTTPConfig,
    SettleGridHTTPClient,
    _AttemptResult,
)


def _sdk() -> SettleGrid:
    return SettleGrid(api_key="sg_live_seller", api_url="https://api.test")


def _http_client(max_retries: int = 2) -> SettleGridHTTPClient:
    return SettleGridHTTPClient(
        HTTPConfig(
            api_url="https://api.test",
            tool_slug="t",
            timeout_ms=1_000,
            max_retries=max_retries,
        )
    )


# ─── wrap.py: defensive early-returns in _meter_or_void_* ────────────────


class TestWrapDefensiveEarlyReturns:
    def test_sync_meter_or_void_returns_when_invocation_is_none(self) -> None:
        """Line 313 — guard against being called outside the CM lifecycle."""
        sg = _sdk()
        wrapper = sg.wrap(meter="m", price_cents=10, api_key="sg_live_buyer")
        # No __enter__ has been called, so _invocation is None.
        assert wrapper._invocation is None
        # Direct invocation must be a no-op (no exception, no metering).
        wrapper._meter_or_void_sync(raised=False)
        sg.close()

    async def test_async_meter_or_void_returns_when_invocation_is_none(self) -> None:
        """Line 327 — async equivalent of the sync guard."""
        sg = _sdk()
        wrapper = sg.wrap(meter="m", price_cents=10, api_key="sg_live_buyer")
        assert wrapper._invocation is None
        await wrapper._meter_or_void_async(raised=False)
        await sg.aclose()

    def test_sync_meter_or_void_returns_when_api_key_is_none(self) -> None:
        """Line 320 — defensive guard if api_key was None on Invocation."""
        sg = _sdk()
        wrapper = sg.wrap(meter="m", price_cents=10, api_key="sg_live_buyer")
        # Manually construct a valid-but-keyless Invocation. (Construction
        # validates non-None at the Wrapper level, but Invocation itself
        # tolerates None — the guard exists for that direct path.)
        wrapper._active = True
        wrapper._invocation = Invocation(meter="m", price_cents=10, api_key=None)
        # No metering call should land — verified by absence of HTTP mock,
        # which would crash if a real request fired.
        wrapper._meter_or_void_sync(raised=False)
        # Invocation must NOT be marked charged.
        assert wrapper._invocation.charged is False
        sg.close()

    async def test_async_meter_or_void_returns_when_api_key_is_none(self) -> None:
        """Line 331 — async equivalent."""
        sg = _sdk()
        wrapper = sg.wrap(meter="m", price_cents=10, api_key="sg_live_buyer")
        wrapper._active = True
        wrapper._invocation = Invocation(meter="m", price_cents=10, api_key=None)
        await wrapper._meter_or_void_async(raised=False)
        assert wrapper._invocation.charged is False
        await sg.aclose()


# ─── _http.py: post-loop defensive raise (lines 343, 366) ────────────────


class TestHTTPPostLoopDefensiveRaise:
    """If every attempt returns ``retry=True`` (impossible via the real
    ``_handle_response`` since the last attempt always errors), the for
    loop exits without returning. The post-loop defensive raise must
    fire instead of silently returning ``None`` to the caller.
    """

    async def test_async_request_post_loop_raise(self, monkeypatch) -> None:
        client = _http_client(max_retries=2)

        # Force EVERY attempt to claim "retry=True" — the real flow's
        # _handle_response never does this on the last attempt, but the
        # defensive raise exists in case a future refactor regresses.
        async def _always_retry(*args, **kwargs):
            return _AttemptResult(retry=True, backoff_ms=1)

        monkeypatch.setattr(client, "_do_attempt_async", _always_retry)
        # Skip the real backoff sleeps.
        monkeypatch.setattr(asyncio, "sleep", lambda *_a, **_k: _async_noop())

        with pytest.raises(SettleGridUnavailableError, match="Exhausted retry"):
            await client.request("/keys/validate", {"apiKey": "k"})
        await client.aclose()

    def test_sync_request_post_loop_raise(self, monkeypatch) -> None:
        client = _http_client(max_retries=2)

        def _always_retry(*args, **kwargs):
            return _AttemptResult(retry=True, backoff_ms=1)

        monkeypatch.setattr(client, "_do_attempt_sync", _always_retry)
        # Skip backoff sleeps.
        import time

        monkeypatch.setattr(time, "sleep", lambda *_a, **_k: None)

        with pytest.raises(SettleGridUnavailableError, match="Exhausted retry"):
            client.request_sync("/keys/validate", {"apiKey": "k"})
        client.close()


async def _async_noop() -> None:
    return None
