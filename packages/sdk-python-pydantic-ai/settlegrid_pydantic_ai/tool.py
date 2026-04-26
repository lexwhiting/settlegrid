"""``metered_tool`` decorator for Pydantic AI.

Framework-aware contract — what makes this NOT a copy of the LangChain
adapter:

- Pydantic AI tools live as :class:`pydantic_ai.tools.Tool` instances
  with the callable held in a ``function`` field (not ``func`` like
  LangChain or ``fn`` like LlamaIndex). The framework uses Pydantic
  v2's signature introspection to derive the JSON schema for the LLM,
  so ``functools.wraps`` preservation of ``__signature__`` is mandatory.

- The agent-binding pattern is different: tools are typically registered
  via ``@agent.tool`` (which ties them to a specific :class:`Agent`) or
  via ``Agent(tools=[Tool(fn)])``. We support BOTH:

  * Decorating a callable BEFORE ``@agent.tool`` / ``Tool(...)`` →
    metering layer fires inside the agent's tool-call dispatch.
  * Decorating a ``Tool`` instance → re-bind ``function`` field via
    ``object.__setattr__`` (Pydantic v2 model — bypasses validators).

- Pydantic AI uses :class:`pydantic_ai.RunContext` as an optional FIRST
  arg (``takes_ctx=True``). The metered wrapper passes through *args
  and **kwargs unchanged, so ctx-taking tools work without special
  handling — the metering happens around the call, not around the
  argument unpacking.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import suppress
from typing import TYPE_CHECKING, Any, TypeVar, cast

if TYPE_CHECKING:
    from settlegrid import SettleGrid


F = TypeVar("F", bound=Callable[..., Any])

_METERED_MARKER = "__settlegrid_metered__"

_default_client: SettleGrid | None = None


def configure(sg: SettleGrid) -> None:
    """Set the module-level default :class:`SettleGrid` client."""
    global _default_client
    if not hasattr(sg, "wrap") or not callable(sg.wrap):
        raise TypeError(
            f"configure: argument must be a SettleGrid instance (got {type(sg).__name__})."
        )
    _default_client = sg


def get_default_client() -> SettleGrid | None:
    """Return the current module-level default client, or ``None``."""
    return _default_client


def reset_default_client() -> None:
    """Clear the module-level default client. Primarily for tests."""
    global _default_client
    _default_client = None


def metered_tool(
    sg: SettleGrid | None = None,
    *,
    meter: str,
    price_cents: int,
    api_key: str | None = None,
) -> Callable[[F], F]:
    """Return a decorator that meters every invocation through SettleGrid.

    Args:
        sg: A :class:`SettleGrid` instance. Optional if :func:`configure`
            has set a module-level default.
        meter: Method / tool slug recorded in SettleGrid for billing.
        price_cents: Per-invocation cost in cents.
        api_key: Optional buyer-side default key.

    Returns:
        A decorator that accepts:

        - A sync or async callable: returns a wrapped callable with
          preserved ``__name__`` / ``__doc__`` / signature so Pydantic
          AI can derive the tool schema. Compose with ``@agent.tool``
          or pass to ``Tool(metered_fn)``.
        - A :class:`pydantic_ai.tools.Tool` instance: re-binds
          ``function`` field via :meth:`object.__setattr__` (Pydantic
          v2 model) and returns the same instance.

    Raises:
        TypeError: If ``sg`` shape is wrong or target is invalid.
        RuntimeError: If neither ``sg`` is provided nor a default
            configured.
    """
    if sg is None:
        sg = _default_client
        if sg is None:
            raise RuntimeError(
                "metered_tool: no SettleGrid client. Either pass `sg` "
                "explicitly or call `configure(SettleGrid(...))` first."
            )

    if not hasattr(sg, "wrap") or not callable(sg.wrap):
        raise TypeError(
            f"metered_tool: first arg must be a SettleGrid instance "
            f"(got {type(sg).__name__}). Forgot the parens? Write "
            "`@metered_tool(sg, meter=..., price_cents=...)`."
        )

    wrapper = sg.wrap(meter=meter, price_cents=price_cents, api_key=api_key)

    def decorator(target: F) -> F:
        if getattr(target, _METERED_MARKER, False):
            raise RuntimeError(
                "metered_tool: target is already metered. Re-wrapping "
                "would double-charge every invocation."
            )

        tool_cls = _try_import_tool()

        if tool_cls is not None and isinstance(target, tool_cls):
            wrapped_tool = _wrap_pydantic_ai_tool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "pydantic_ai.tools.Tool; got "
                f"{type(target).__name__}"
            )

        wrapped_func = wrapper(target)
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── Tool wrapping ──────────────────────────────────────────────────────


def _wrap_pydantic_ai_tool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch
    """Re-bind a Pydantic AI ``Tool``'s ``function`` field in place.

    Pydantic AI's ``Tool`` is a Pydantic v2 model — field assignment is
    supported via ``object.__setattr__`` (bypasses validator-on-assignment
    if a future framework version adds one).
    """
    fn = getattr(tool, "function", None)
    if fn is None or not callable(fn):
        raise TypeError(
            "metered_tool: pydantic_ai.tools.Tool has no callable "
            "`function` field — nothing to wrap."
        )
    # H-PA-1 hostile fix — `function` may carry our marker if the user
    # wrapped the callable before constructing the Tool. Re-wrapping
    # would double-charge every invocation.
    if getattr(fn, _METERED_MARKER, False):
        raise RuntimeError(
            "metered_tool: the Tool's underlying `function` is already "
            "metered. Re-wrapping would double-charge every invocation. "
            "Apply metered_tool exactly once per tool."
        )
    object.__setattr__(tool, "function", wrapper(fn))
    return tool


# ─── lazy framework import ──────────────────────────────────────────────


def _try_import_tool() -> type | None:
    """Return ``pydantic_ai.tools.Tool`` if importable."""
    try:
        from pydantic_ai.tools import Tool

        return Tool
    except ImportError:  # pragma: no cover — defensive fallback
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
