"""Tests for ``settlegrid_pydantic_ai.metered_tool``.

Stubbed-agent strategy: a Pydantic AI ``Agent`` requires an LLM model
to instantiate and an event loop to run. Instead, we construct
``Tool`` instances directly and invoke their ``function`` field — the
same callable a real agent's tool dispatcher hits — which exercises the
metering layer without spinning up an LLM.
"""

from __future__ import annotations

import inspect

import httpx
import pytest
import respx
from pydantic_ai.tools import Tool
from settlegrid import SettleGrid

from settlegrid_pydantic_ai import (
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

    def test_no_default_no_sg_raises(self) -> None:
        with pytest.raises(RuntimeError, match="no SettleGrid client"):
            metered_tool(meter="m", price_cents=10)

    def test_invalid_sg_type_raises(self) -> None:
        with pytest.raises(TypeError, match="SettleGrid instance"):
            metered_tool(42, meter="m", price_cents=10)  # type: ignore[arg-type]

    def test_configure_rejects_non_settlegrid(self) -> None:
        """Coverage for configure()'s type guard."""
        from settlegrid_pydantic_ai import configure

        with pytest.raises(TypeError, match="SettleGrid instance"):
            configure(42)  # type: ignore[arg-type]

    def test_get_default_client_returns_none_initially(self) -> None:
        """Coverage for get_default_client when no default is set."""
        from settlegrid_pydantic_ai import get_default_client

        assert get_default_client() is None

    def test_target_must_be_callable_or_tool(self) -> None:
        """Non-callable, non-Tool target → TypeError."""
        sg = _sdk()
        with pytest.raises(TypeError, match="callable or a"):
            metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(
                42  # type: ignore[arg-type]
            )
        sg.close()


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
            """Search the web."""
            return f"results for {query}"

        assert search("hello") == "results for hello"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        sg.close()

    def test_preserves_introspection(self) -> None:
        """Pydantic AI builds the JSON schema from inspect.signature →
        functools.wraps preservation is mandatory or the agent's tool
        schema would be wrong/empty."""
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def search(query: str, top_k: int = 5) -> str:
            """Search the web."""
            return query

        assert search.__name__ == "search"
        assert search.__doc__ == "Search the web."
        sig = inspect.signature(search)
        assert list(sig.parameters.keys()) == ["query", "top_k"]
        sg.close()


# ─── Tool instance wrapping (framework-aware) ───────────────────────────


class TestToolInstance:
    @respx.mock(base_url=API_URL)
    def test_wraps_tool_function_field(self, respx_mock) -> None:
        """Pydantic AI's ``Tool`` carries the callable in ``function``
        (NOT ``func`` like LangChain or ``fn`` like LlamaIndex). The
        metered_tool decorator must re-bind ``function`` in place."""
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

        t = Tool(search_fn, name="search")
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)
        # Same instance, in-place wrap.
        assert wrapped is t

        # Invocation through the tool's `function` field meters.
        result = t.function(query="hello")
        assert result == "results for hello"
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_wrap_rebinds_function_schema_dispatch_path(self, respx_mock) -> None:
        """HH-PA-2 regression — Pydantic AI's agent loop dispatches via
        ``tool.function_schema.call(args, ctx)`` (see
        ``pydantic_ai.toolsets.function.FunctionToolsetTool.call_func``),
        which reads ``self.function`` *inside* the ``FunctionSchema``
        dataclass. ``Tool.__init__`` captures the function in TWO places:
        ``tool.function`` and ``tool.function_schema.function``. The
        earlier wrapper only updated ``tool.function`` — the dispatcher
        kept hitting the unwrapped callable and metering never fired
        on real agent runs. The fix rebinds both."""
        from unittest.mock import MagicMock

        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        def search_fn(query: str) -> str:
            """Search."""
            return f"r:{query}"

        t = Tool(search_fn, name="search")
        metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)

        # Both references point to the same metered callable.
        assert t.function is t.function_schema.function
        assert t.function is not search_fn

        # Hit the framework's actual dispatch surface (NOT t.function(...)).
        ctx = MagicMock()
        result = await t.function_schema.call({"query": "hi"}, ctx)
        assert result == "r:hi"
        assert meter_route.call_count == 1
        sg.close()

    def test_tool_with_metered_function_raises(self) -> None:
        """H-PA-1 regression — if a user wraps a callable, then constructs
        a ``Tool`` around it, then re-wraps the Tool, we'd double-meter
        every call. The fix detects the marker on `function` and refuses."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            """f."""
            return q

        metered_fn = deco(f)
        t = Tool(metered_fn, name="f")
        with pytest.raises(RuntimeError, match="already metered"):
            deco(t)
        sg.close()

    def test_tool_with_no_function_raises(self) -> None:
        sg = _sdk()

        # Construct a Tool then strip its function to simulate the
        # error path. Pydantic v2 model — direct setattr bypasses
        # validation; this is a synthetic edge case.
        def f(q: str) -> str:
            """f."""
            return q

        t = Tool(f, name="f")
        object.__setattr__(t, "function", None)

        with pytest.raises(TypeError, match="no callable `function`"):
            metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)
        sg.close()


# ─── stubbed agent loop ─────────────────────────────────────────────────


class TestStubbedAgent:
    @respx.mock(base_url=API_URL)
    def test_stub_agent_dispatches_and_meters(self, respx_mock) -> None:
        """A Pydantic AI agent's tool dispatcher walks tool calls from
        the LLM, picks the matching ``Tool`` by name, and invokes
        ``tool.function(**args)``. Stub that loop without an LLM."""
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

        t = Tool(search, name="search")

        class StubAgent:
            def __init__(self, tools: list) -> None:
                self._tools = {tool.name: tool for tool in tools}

            def step(self, tool_call: dict) -> str:
                tool = self._tools[tool_call["name"]]
                return str(tool.function(**tool_call["args"]))

        agent = StubAgent(tools=[t])
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

        @metered_tool(meter="m", price_cents=10, api_key=BUYER_KEY)
        def f(q: str) -> str:
            return q

        assert f("hi") == "hi"
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
