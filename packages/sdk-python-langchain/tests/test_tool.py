"""Tests for ``settlegrid_langchain.metered_tool``.

Covers:

- Plain callable wrapping (sync + async).
- LangChain ``@tool``-decorated function wrapping (the common case).
- LangChain ``StructuredTool`` instance wrapping with both ``func`` and
  ``coroutine``.
- Introspection preservation: name, docstring, signature, args_schema.
- Metering side-effects: validate_key + meter both fire on success.
- Failure semantics: handler raise → no meter call (pay-only-for-success).
- Validation errors at decoration time.

The SettleGrid client is a real :class:`SettleGrid` instance against an
``api.test`` base URL with ``respx`` stubbing the HTTP layer — no real
network calls.
"""

from __future__ import annotations

import inspect

import httpx
import pytest
import respx
from langchain_core.tools import BaseTool, StructuredTool, tool
from settlegrid import SettleGrid

from settlegrid_langchain import metered_tool

API_URL = "https://api.test"
SELLER_KEY = "sg_live_seller"
BUYER_KEY = "sg_live_buyer"


def _sdk() -> SettleGrid:
    return SettleGrid(
        api_key=SELLER_KEY,
        tool_slug="my-tool",
        api_url=API_URL,
    )


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


# ─── decoration-time validation ──────────────────────────────────────────


class TestDecorationValidation:
    def test_rejects_empty_meter(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match="meter"):
            metered_tool(sg, meter="", price_cents=10)
        sg.close()

    def test_rejects_negative_price_cents(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match=">= 0"):
            metered_tool(sg, meter="m", price_cents=-1)
        sg.close()

    def test_rejects_bool_price_cents(self) -> None:
        sg = _sdk()
        with pytest.raises(TypeError):
            metered_tool(sg, meter="m", price_cents=True)  # type: ignore[arg-type]
        sg.close()

    def test_rejects_non_callable_target(self) -> None:
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10)
        with pytest.raises(TypeError, match="callable"):
            deco(42)  # type: ignore[arg-type]
        sg.close()

    def test_rejects_empty_api_key(self) -> None:
        sg = _sdk()
        with pytest.raises(ValueError, match="api_key"):
            metered_tool(sg, meter="m", price_cents=10, api_key="")
        sg.close()


# ─── plain callable wrapping ────────────────────────────────────────────


class TestPlainCallable:
    @respx.mock(base_url=API_URL)
    def test_sync_callable_runs_handler_and_meters(self, respx_mock) -> None:
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        result = search("python")
        assert result == "results for python"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_async_callable_runs_handler_and_meters(
        self, respx_mock
    ) -> None:
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        async def search(query: str) -> str:
            """Search the web (async)."""
            return f"results for {query}"

        assert await search("py") == "results for py"
        assert meter_route.call_count == 1
        await sg.aclose()

    @respx.mock(base_url=API_URL, assert_all_called=False)
    def test_handler_raise_skips_meter(self, respx_mock) -> None:
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            search("x")
        assert not meter_route.called
        sg.close()


# ─── introspection preservation (the hostile-contract focus) ────────────


class TestIntrospection:
    def test_preserves_dunder_name(self) -> None:
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def my_search(query: str) -> str:
            """Look stuff up."""
            return query

        assert my_search.__name__ == "my_search"
        sg.close()

    def test_preserves_docstring(self) -> None:
        """LangChain's ``@tool`` reads ``__doc__`` for the tool's
        description; if we drop it, agents can't reason about the tool."""
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def my_search(query: str) -> str:
            """Look stuff up by query."""
            return query

        assert my_search.__doc__ == "Look stuff up by query."
        sg.close()

    def test_preserves_signature(self) -> None:
        """LangChain's tool introspection builds args_schema from
        ``inspect.signature``; preserving the signature is mandatory."""
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def my_search(query: str, top_k: int = 5) -> str:
            return query

        sig = inspect.signature(my_search)
        params = list(sig.parameters.keys())
        assert params == ["query", "top_k"]
        assert sig.parameters["top_k"].default == 5
        # Return annotation passes through too. With
        # `from __future__ import annotations`, annotations are PEP 563
        # string forms; compare as string OR resolved type for
        # robustness across import modes.
        assert sig.return_annotation in (str, "str")
        sg.close()

    def test_preserves_module(self) -> None:
        sg = _sdk()

        @metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)
        def my_search(query: str) -> str:
            return query

        assert my_search.__module__ == __name__
        sg.close()


# ─── LangChain ``@tool`` integration ────────────────────────────────────


class TestLangChainAtTool:
    @respx.mock(base_url=API_URL)
    def test_at_tool_then_metered_tool_composes(self, respx_mock) -> None:
        """The common usage pattern: ``@tool`` on top of ``@metered_tool``.

        Outer ``@tool`` reads the (preserved) docstring and signature
        from the metered callable to build a ``StructuredTool``. The
        invocation flow then routes through metering.
        """
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @tool
        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        def search(query: str) -> str:
            """Search the web."""
            return f"results for {query}"

        # @tool produces a StructuredTool / BaseTool subclass.
        assert isinstance(search, BaseTool)
        # Description came from the docstring through the metered wrapper.
        assert "Search the web" in search.description
        # Tool name comes from __name__ — must match.
        assert search.name == "search"

        # Invoke through LangChain's tool API.
        result = search.invoke({"query": "hello"})
        assert result == "results for hello"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_at_tool_async_composes(self, respx_mock) -> None:
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        @tool
        @metered_tool(sg, meter="search", price_cents=10, api_key=BUYER_KEY)
        async def search(query: str) -> str:
            """Async search."""
            return f"results for {query}"

        assert isinstance(search, BaseTool)
        result = await search.ainvoke({"query": "hi"})
        assert result == "results for hi"
        assert meter_route.call_count == 1
        await sg.aclose()


# ─── BaseTool / StructuredTool direct wrapping ──────────────────────────


class TestBaseToolWrapping:
    @respx.mock(base_url=API_URL)
    def test_wraps_structured_tool_in_place(self, respx_mock) -> None:
        sg = _sdk()
        validate_route = respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        def search_fn(query: str) -> str:
            """Manual tool function."""
            return f"results for {query}"

        st = StructuredTool.from_function(search_fn, name="search")
        wrapped = metered_tool(
            sg, meter="search", price_cents=10, api_key=BUYER_KEY
        )(st)

        # In-place wrap — same object reference.
        assert wrapped is st
        # Invocation now meters.
        result = st.invoke({"query": "hi"})
        assert result == "results for hi"
        assert validate_route.call_count == 1
        assert meter_route.call_count == 1
        sg.close()

    @respx.mock(base_url=API_URL)
    async def test_wraps_async_structured_tool(self, respx_mock) -> None:
        """Covers the ``coroutine`` slot wrapping path in _wrap_basetool."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        async def search_fn_async(query: str) -> str:
            """Async manual tool."""
            return f"async results for {query}"

        st = StructuredTool.from_function(
            coroutine=search_fn_async, name="search_async"
        )
        wrapped = metered_tool(
            sg, meter="search", price_cents=10, api_key=BUYER_KEY
        )(st)
        assert wrapped is st
        result = await st.ainvoke({"query": "hi"})
        assert result == "async results for hi"
        assert meter_route.call_count == 1
        await sg.aclose()

    def test_basetool_with_no_func_raises(self) -> None:
        """A BaseTool with no func and no coroutine is a programming
        error — surface it at decoration time, not invocation time."""

        # Build a minimal BaseTool subclass with no execution slots.
        class EmptyTool(BaseTool):
            name: str = "empty"
            description: str = "empty"

            def _run(self, *args: object, **kwargs: object) -> str:
                return "ok"

        sg = _sdk()
        empty = EmptyTool()
        with pytest.raises(TypeError, match="neither `func` nor `coroutine`"):
            metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(empty)
        sg.close()


# ─── hostile-review regressions ─────────────────────────────────────────


class TestHostileReviewRegressions:
    """Regression tests for findings in the R3 hostile review."""

    def test_rewrap_function_raises(self) -> None:
        """H4/H5 — re-applying metered_tool to an already-wrapped
        function would double-charge each invocation. Reject it."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def search(q: str) -> str:
            return q

        wrapped_once = deco(search)
        with pytest.raises(RuntimeError, match="already metered"):
            deco(wrapped_once)
        sg.close()

    def test_rewrap_basetool_raises(self) -> None:
        """H4/H5 — same protection for BaseTool re-wrapping."""
        sg = _sdk()
        deco = metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)

        def search_fn(q: str) -> str:
            """Doc."""
            return q

        st = StructuredTool.from_function(search_fn, name="search")
        wrapped_once = deco(st)
        with pytest.raises(RuntimeError, match="already metered"):
            deco(wrapped_once)
        sg.close()

    def test_missing_parens_raises_actionable_error(self) -> None:
        """H10/H11 — `@metered_tool` (no parens) passes the function as
        sg. The error must point at the missing-parens mistake."""

        def search(q: str) -> str:
            return q

        with pytest.raises(TypeError, match="forgot the parens"):
            metered_tool(search, meter="m", price_cents=10)  # type: ignore[arg-type]

    def test_invalid_sg_type_raises(self) -> None:
        """H10/H11 — passing None / int / random object as sg."""
        with pytest.raises(TypeError, match="SettleGrid instance"):
            metered_tool(None, meter="m", price_cents=10)  # type: ignore[arg-type]
        with pytest.raises(TypeError, match="SettleGrid instance"):
            metered_tool(42, meter="m", price_cents=10)  # type: ignore[arg-type]

    @respx.mock(base_url=API_URL)
    async def test_async_in_coroutine_slot_still_meters(self, respx_mock) -> None:
        """H1 — wrapping the coroutine slot must produce a metered async.
        Previous logic skipped if the slot's function type didn't match
        a hardcoded check; now it wraps unconditionally."""
        sg = _sdk()
        respx_mock.post("/api/sdk/keys/validate").mock(
            return_value=_validate_response()
        )
        meter_route = respx_mock.post("/api/sdk/meter").mock(
            return_value=_meter_response()
        )

        async def async_handler(q: str) -> str:
            """Async handler."""
            return f"async:{q}"

        st = StructuredTool.from_function(
            coroutine=async_handler, name="async_handler"
        )
        metered_tool(sg, meter="m", price_cents=10, api_key=BUYER_KEY)(st)
        result = await st.ainvoke({"q": "x"})
        assert result == "async:x"
        assert meter_route.call_count == 1
        await sg.aclose()


# ─── public surface ─────────────────────────────────────────────────────


class TestPublicSurface:
    def test_metered_tool_exported(self) -> None:
        from settlegrid_langchain import __version__
        from settlegrid_langchain import metered_tool as mt

        assert callable(mt)
        assert isinstance(__version__, str)
        assert len(__version__) > 0
