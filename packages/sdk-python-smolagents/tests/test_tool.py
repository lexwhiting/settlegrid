"""Tests for ``settlegrid_smolagents.metered_tool``.

Stubbed-agent strategy: a real smolagents ``CodeAgent`` requires an LLM.
Instead, we exercise the tool's public dispatch surface
(``tool(*args, **kwargs)`` → ``Tool.__call__`` → ``self.forward``)
directly — the same surface the agent loop hits. This verifies the
metering fires through the real smolagents execution path without
external dependencies.
"""

from __future__ import annotations

import inspect

import httpx
import pytest
import respx
from settlegrid import SettleGrid
from smolagents import Tool, tool

from settlegrid_smolagents import (
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
        with pytest.raises(TypeError, match="SettleGrid instance"):
            configure(42)  # type: ignore[arg-type]

    def test_get_default_client_returns_none_initially(self) -> None:
        from settlegrid_smolagents import get_default_client

        assert get_default_client() is None

    def test_target_must_be_callable_or_tool(self) -> None:
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
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def search(query: str, top_k: int = 5) -> str:
            """Search."""
            return query

        assert search.__name__ == "search"
        assert search.__doc__ == "Search."
        sig = inspect.signature(search)
        assert list(sig.parameters.keys()) == ["query", "top_k"]
        sg.close()


# ─── @tool-built SimpleTool wrapping ────────────────────────────────────


@tool
def _module_search(query: str) -> str:
    """Search the web.

    Args:
        query: The query to search for.
    """
    return f"results for {query}"


class TestAtTool:
    @respx.mock(base_url=API_URL)
    def test_wraps_at_tool_via_forward(self, respx_mock) -> None:
        """smolagents' ``@tool`` decorator produces a ``SimpleTool``
        whose ``forward`` is the user's function (instance attr, not
        bound method). The metered_tool decorator must replace
        ``forward`` so ``Tool.__call__`` dispatch — which calls
        ``self.forward(*args, **kwargs)`` — meters."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(
            _module_search
        )
        # In-place wrap.
        assert wrapped is _module_search
        assert _module_search.name == "_module_search"

        # Public dispatch surface — what an agent actually invokes.
        result = _module_search(query="hello")
        assert "results for hello" in str(result)
        assert meter_route.call_count == 1
        sg.close()


# ─── custom Tool subclass ───────────────────────────────────────────────


class _SearchTool(Tool):
    name = "search"
    description = "Search the web."
    inputs = {"query": {"type": "string", "description": "The query"}}
    output_type = "string"

    def forward(self, query: str) -> str:
        return f"custom: {query}"


class TestCustomTool:
    @respx.mock(base_url=API_URL)
    def test_wraps_custom_tool_forward_method(self, respx_mock) -> None:
        """Custom smolagents Tool subclasses define ``forward`` as a
        class method. Patching at the instance level shadows the class
        method without leaking to other instances of the same subclass.
        Verify with TWO instances — only the wrapped one meters."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        st = _SearchTool()
        other = _SearchTool()
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(st)
        assert wrapped is st

        # Wrapped instance dispatches through metered forward.
        result = st(query="hi")
        assert "custom: hi" in str(result)
        assert meter_route.call_count == 1

        # Sibling instance is unaffected — class method still original.
        other_result = other(query="hi")
        assert "custom: hi" in str(other_result)
        assert meter_route.call_count == 1  # No extra meter call.
        sg.close()

    def test_at_tool_with_metered_fn_raises(self) -> None:
        """If a user wraps a callable, then patches ``forward`` with
        the metered callable, then calls metered_tool on the Tool, we'd
        double-meter every dispatch. The fix detects the marker on
        ``forward`` and refuses."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        @tool
        def search(query: str) -> str:
            """Search.

            Args:
                query: The query
            """
            return f"r:{query}"

        # Patch forward with an already-metered callable (simulating a
        # user who wrapped the function separately and then assigned it
        # via raw setattr without going through metered_tool()).
        def _underlying(query: str) -> str:
            return f"r:{query}"

        metered_fn = deco(_underlying)
        object.__setattr__(search, "forward", metered_fn)

        with pytest.raises(RuntimeError, match="already metered"):
            deco(search)
        sg.close()

    def test_tool_with_no_forward_raises(self) -> None:
        """Synthetic edge case: a Tool subclass with forward stripped
        triggers the no-callable-forward error."""
        sg = _sdk()

        st = _SearchTool()
        object.__setattr__(st, "forward", None)
        with pytest.raises(TypeError, match="no callable `forward`"):
            metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(st)
        sg.close()


# ─── stubbed agent loop ─────────────────────────────────────────────────


@tool
def _stub_search(query: str) -> str:
    """Search.

    Args:
        query: The query to search for.
    """
    return f"results for {query}"


class TestStubbedAgent:
    @respx.mock(base_url=API_URL)
    def test_stub_agent_dispatches_and_meters(self, respx_mock) -> None:
        """A smolagents agent picks tools by name and invokes
        ``tool(**args)``. Stub that loop without an LM."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)(
            _stub_search
        )

        class StubAgent:
            def __init__(self, tools: list) -> None:
                self._tools = {t.name: t for t in tools}

            def step(self, tool_call: dict) -> str:
                t = self._tools[tool_call["name"]]
                return str(t(**tool_call["args"]))

        agent = StubAgent(tools=[_stub_search])
        r1 = agent.step({"name": "_stub_search", "args": {"query": "a"}})
        r2 = agent.step({"name": "_stub_search", "args": {"query": "b"}})

        assert "results for a" in r1
        assert "results for b" in r2
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
