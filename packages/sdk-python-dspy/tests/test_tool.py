"""Tests for ``settlegrid_dspy.metered_tool``.

Stubbed-agent strategy: a real DSPy ``Predict`` / ``ReAct`` requires an
LLM. Instead, we construct ``dspy.Tool`` instances directly and invoke
them through their public dispatch surface (``tool(**kwargs)`` for sync,
``await tool.acall(**kwargs)`` for async) — the same surface DSPy's
agent loop hits. This exercises the metering layer without spinning up
an LLM.
"""

from __future__ import annotations

import inspect

import dspy
import httpx
import pytest
import respx
from settlegrid import SettleGrid

from settlegrid_dspy import (
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
        from settlegrid_dspy import get_default_client

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
        """DSPy auto-derives args / arg_types / arg_desc from the
        function signature + docstring at Tool() construction time, so
        functools.wraps preservation is mandatory."""
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


# ─── dspy.Tool wrapping (framework-aware) ───────────────────────────────


class TestDspyTool:
    @respx.mock(base_url=API_URL)
    def test_wraps_tool_via_func_field(self, respx_mock) -> None:
        """DSPy's ``Tool.__call__`` reads ``self.func`` live, so a
        single re-bind meters the sync dispatch path."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        def search_fn(query: str) -> str:
            """Search."""
            return f"results for {query}"

        t = dspy.Tool(func=search_fn, name="search")
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)
        # In-place wrap.
        assert wrapped is t

        # Public sync dispatch — Tool(**kwargs) → self.func(**parsed).
        result = t(query="hello")
        assert result == "results for hello"
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_wraps_tool_acall_dispatch(self, respx_mock) -> None:
        """``Tool.acall`` also reads ``self.func`` live (verified by
        inspecting dspy/adapters/types/tool.py). The single rebind we
        do should therefore meter the async dispatch path too."""
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

        t = dspy.Tool(func=search_async, name="async_search")
        metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)

        # acall awaits the coroutine result.
        result = await t.acall(query="hi")
        assert result == "async:hi"
        assert meter_route.call_count == 1
        await sg.aclose()

    def test_tool_with_metered_func_raises(self) -> None:
        """If a user wraps a callable, then constructs a dspy.Tool
        around it, then re-wraps the Tool, we'd double-meter every call.
        The fix detects the marker on `func` and refuses."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            """f."""
            return q

        metered_fn = deco(f)
        t = dspy.Tool(func=metered_fn, name="f")
        with pytest.raises(RuntimeError, match="already metered"):
            deco(t)
        sg.close()

    def test_tool_with_no_func_raises(self) -> None:
        """If a Tool's `func` is stripped (synthetic edge case),
        _wrap_dspy_tool raises TypeError."""
        sg = _sdk()

        def f(q: str) -> str:
            """f."""
            return q

        t = dspy.Tool(func=f, name="f")
        object.__setattr__(t, "func", None)
        with pytest.raises(TypeError, match="no callable `func`"):
            metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(t)
        sg.close()


# ─── stubbed agent loop ─────────────────────────────────────────────────


class TestStubbedAgent:
    @respx.mock(base_url=API_URL)
    def test_stub_agent_dispatches_and_meters(self, respx_mock) -> None:
        """A DSPy agent's tool-call loop picks tools by name from a
        registry and invokes ``tool(**args)`` (the public sync
        dispatch). Stub that loop without an LM."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        def search_fn(query: str) -> str:
            """Search."""
            return f"results for {query}"

        t = dspy.Tool(func=search_fn, name="search")
        metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)(t)

        class StubAgent:
            def __init__(self, tools: list) -> None:
                self._tools = {tool.name: tool for tool in tools}

            def step(self, tool_call: dict) -> str:
                tool = self._tools[tool_call["name"]]
                return str(tool(**tool_call["args"]))

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
