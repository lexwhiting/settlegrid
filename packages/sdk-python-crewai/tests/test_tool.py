"""Tests for ``settlegrid_crewai.metered_tool``.

Stubbed-agent strategy: a CrewAI ``Agent`` requires an LLM-backed
``llm`` arg to instantiate. Instead, we use a minimal ``StubCrew`` that
mirrors what an agent does: receive a tool-call instruction, look up
the tool by ``name``, call ``tool.run(**args)``. This exercises the
metered ``func`` / ``_run`` paths without external API calls.
"""

from __future__ import annotations

import inspect

import httpx
import pytest
import respx
from crewai.tools import BaseTool, tool
from pydantic import BaseModel, Field
from settlegrid import SettleGrid

from settlegrid_crewai import (
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

    def test_rewrap_raises(self) -> None:
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            return q

        wrapped = deco(f)
        with pytest.raises(RuntimeError, match="already metered"):
            deco(wrapped)
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


# ─── @tool-built Tool wrapping (framework-aware) ────────────────────────


class TestAtTool:
    def test_at_tool_with_metered_fn_raises(self) -> None:
        """H-CA-1 regression — if a user wraps a callable, then decorates
        with CrewAI's @tool, then re-wraps the Tool, we'd double-meter
        every call. The fix detects the marker on `func` and refuses."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def f(q: str) -> str:
            """Search."""
            return q

        metered_fn = deco(f)
        # Build a CrewAI Tool whose `func` is the already-metered callable.
        decorated = tool("Search")(metered_fn)
        with pytest.raises(RuntimeError, match="already metered"):
            deco(decorated)
        sg.close()

    @respx.mock(base_url=API_URL)
    def test_wraps_at_tool_via_func_field(self, respx_mock) -> None:
        """CrewAI's @tool produces a ``Tool`` instance with the original
        function in the ``func`` field. The metered_tool decorator must
        re-bind ``func`` (NOT replace ``_run``, which Tool delegates
        to ``func``)."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @tool("Search")
        def search(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(search)
        # Same instance, in-place wrap.
        assert wrapped is search
        # Name preserved.
        assert search.name == "Search"

        result = search.run(query="hello")
        assert "results for hello" in str(result)
        assert meter_route.call_count == 1
        sg.close()


# ─── custom BaseTool subclass with _run override ────────────────────────


class TestCustomBaseTool:
    @respx.mock(base_url=API_URL)
    def test_wraps_custom_basetool_run_method(self, respx_mock) -> None:
        """Custom CrewAI tools with their own ``_run`` impl. The
        metered_tool decorator must monkey-patch ``_run`` on the
        INSTANCE so the metering wraps the method-style execution path
        (the framework-aware case the LangChain pattern doesn't cover)."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        class SearchInput(BaseModel):
            query: str = Field(..., description="The query")

        class SearchTool(BaseTool):
            name: str = "search"
            description: str = "Search the web."
            args_schema: type[BaseModel] = SearchInput

            def _run(self, query: str) -> str:
                return f"custom: {query}"

        st = SearchTool()
        wrapped = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(st)
        assert wrapped is st

        result = st.run(query="hi")
        assert "custom: hi" in str(result)
        assert meter_route.call_count == 1
        sg.close()


# ─── stubbed agent loop ─────────────────────────────────────────────────


class TestStubbedAgent:
    @respx.mock(base_url=API_URL)
    def test_stub_crew_dispatches_and_meters(self, respx_mock) -> None:
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @tool("Search")
        def search(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(search)

        class StubCrew:
            def __init__(self, tools: list) -> None:
                self._tools = {t.name: t for t in tools}

            def execute(self, tool_call: dict) -> str:
                t = self._tools[tool_call["name"]]
                return str(t.run(**tool_call["args"]))

        crew = StubCrew(tools=[search])
        r1 = crew.execute({"name": "Search", "args": {"query": "a"}})
        r2 = crew.execute({"name": "Search", "args": {"query": "b"}})

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
