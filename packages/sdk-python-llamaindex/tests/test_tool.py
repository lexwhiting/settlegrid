"""Tests for ``settlegrid_llamaindex.metered_tool``.

Stubbed-agent strategy: instead of spinning up a real LlamaIndex agent
(which would need an LLM key + network), we construct ``FunctionTool``
instances and dispatch them through a minimal ``StubAgent`` that picks
a tool by name and calls ``tool.call(**args)`` — same surface a real
agent's tool-call loop hits. This verifies the metering fires through
the real LlamaIndex execution path without external dependencies.
"""

from __future__ import annotations

import inspect

import httpx
import pytest
import respx
from llama_index.core.tools import FunctionTool
from settlegrid import SettleGrid

from settlegrid_llamaindex import (
    configure,
    metered_tool,
    reset_default_client,
)

API_URL = "https://api.test"
SELLER_KEY = "sg_live_seller"
BUYER_KEY = "sg_live_buyer"


@pytest.fixture(autouse=True)
def _reset_module_state():
    reset_default_client()
    yield
    reset_default_client()


def _sdk() -> SettleGrid:
    return SettleGrid(api_key=SELLER_KEY, tool_slug="my-tool", api_url=API_URL)


def _validate_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "valid": True,
            "balanceCents": 5000,
            "consumerId": "c",
            "toolId": "t",
            "keyId": "k",
        },
    )


def _meter_response(cost: int = 10) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "success": True,
            "remainingBalanceCents": 4990,
            "costCents": cost,
            "invocationId": "inv_1",
        },
    )


# ─── decoration validation ──────────────────────────────────────────────


class TestDecorationValidation:
    def test_rejects_empty_meter(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match="meter"):
            metered_tool(sg, meter="", price_cents=10)
        sg.close()

    def test_rejects_negative_price(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match=">= 0"):
            metered_tool(sg, meter="m", price_cents=-1)
        sg.close()

    def test_no_default_no_sg_raises(self) -> None:
        with pytest.raises(RuntimeError, match="no SettleGrid client"):
            metered_tool(meter="m", price_cents=10)

    def test_invalid_sg_type_raises(self) -> None:
        with pytest.raises(TypeError, match="SettleGrid instance"):
            metered_tool(42, meter="m", price_cents=10)  # type: ignore[arg-type]


# ─── plain callable ─────────────────────────────────────────────────────


class TestCallable:
    @respx.mock(base_url=API_URL)
    def test_sync_callable_meters(self, respx_mock) -> None:
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            """Search."""
            return f"results for {query}"

        assert search("hello") == "results for hello"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        sg.close()

    def test_preserves_introspection(self) -> None:
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def search(query: str, top_k: int = 5) -> str:
            """Look stuff up."""
            return query

        assert search.__name__ == "search"
        assert search.__doc__ == "Look stuff up."
        sig = inspect.signature(search)
        assert list(sig.parameters.keys()) == ["query", "top_k"]
        sg.close()


# ─── FunctionTool wrapping (framework-aware) ────────────────────────────


class TestFunctionTool:
    @respx.mock(base_url=API_URL)
    def test_wraps_function_tool_preserves_metadata(self, respx_mock) -> None:
        """The hostile-contract test — wrapping a FunctionTool must
        preserve ``ToolMetadata`` (name, description, fn_schema) so the
        agent's tool-router still finds the tool correctly."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        def search_fn(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        ft = FunctionTool.from_defaults(
            fn=search_fn, name="search", description="Web search."
        )
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(ft)

        # New FunctionTool but with preserved metadata.
        assert isinstance(wrapped, FunctionTool)
        assert wrapped.metadata.name == "search"
        assert wrapped.metadata.description == "Web search."

        # Invocation goes through metering.
        result = wrapped.call(query="hello")
        assert "results for hello" in str(result)
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_wrap_preserves_callback_and_partial_params(self, respx_mock) -> None:
        """HH-LI-2 regression — `_wrap_function_tool` rebuilds the
        FunctionTool via ``from_defaults``. The earlier version forwarded
        only name/description/fn_schema/return_direct, silently dropping
        the user's ``callback`` and ``partial_params``. The fix forwards
        every kwarg the original tool was constructed with."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        cb_calls: list = []

        def cb(result: object, **_k: object) -> None:
            cb_calls.append(result)

        def search(query: str = "default") -> str:
            """Search."""
            return f"r:{query}"

        ft = FunctionTool.from_defaults(
            fn=search,
            name="x",
            callback=cb,
            partial_params={"query": "preset"},
        )

        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(ft)

        # partial_params and callback survive the rebuild.
        assert wrapped.partial_params == {"query": "preset"}
        assert getattr(wrapped, "_callback", None) is not None

        # Calling without args uses partial_params; callback fires with the
        # result; metering still fires once.
        result = wrapped.call()
        assert "r:preset" in str(result)
        assert cb_calls == ["r:preset"]
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_wraps_async_function_tool(self, respx_mock) -> None:
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        async def search_async(query: str) -> str:
            """Async search."""
            return f"async:{query}"

        ft = FunctionTool.from_defaults(async_fn=search_async, name="async_search")
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(ft)

        result = await wrapped.acall(query="hi")
        assert "async:hi" in str(result)
        assert meter_route.call_count == 1
        await sg.aclose()


# ─── stubbed agent loop ─────────────────────────────────────────────────


class TestStubbedAgent:
    @respx.mock(base_url=API_URL)
    def test_stub_agent_dispatches_and_meters(self, respx_mock) -> None:
        """Mimics what a LlamaIndex agent's tool-call dispatch does:
        pick a tool by name from a registry, call ``tool.call(**args)``,
        observe the result. Asserts metering fires per call."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        ft = FunctionTool.from_defaults(fn=search, name="search")

        class StubAgent:
            def __init__(self, tools: list) -> None:
                self._tools = {t.metadata.name: t for t in tools}

            def step(self, tool_call: dict) -> str:
                tool = self._tools[tool_call["name"]]
                return str(tool.call(**tool_call["args"]).raw_output)

        agent = StubAgent(tools=[ft])
        r1 = agent.step({"name": "search", "args": {"query": "a"}})
        r2 = agent.step({"name": "search", "args": {"query": "b"}})

        assert r1 == "results for a"
        assert r2 == "results for b"
        assert meter_route.call_count == 2
        sg.close()


# ─── configure() / default client ───────────────────────────────────────


class TestConfigure:
    @respx.mock(base_url=API_URL)
    def test_configure_then_bare_signature(self, respx_mock) -> None:
        sg = _sdk()
        configure(sg)
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            """Search."""
            return query

        assert search("hi") == "hi"
        assert meter_route.call_count == 1
        sg.close()

    def test_rewrap_raises(self) -> None:
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            return q

        wrapped = deco(f)
        with pytest.raises(RuntimeError, match="already metered"):
            deco(wrapped)
        sg.close()

    def test_function_tool_with_metered_fn_raises(self) -> None:
        """H-LI-1 regression — if a user wraps a callable, then hands the
        wrapped fn to ``FunctionTool.from_defaults``, then re-wraps the
        Tool, we'd double-meter every call. The fix detects the marker
        on the underlying fn and refuses."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            """Search."""
            return q

        metered_fn = deco(f)
        ft = FunctionTool.from_defaults(fn=metered_fn, name="search")
        with pytest.raises(RuntimeError, match="already metered"):
            deco(ft)
        sg.close()
