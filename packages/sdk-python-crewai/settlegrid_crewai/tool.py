"""``metered_tool`` decorator for CrewAI.

Framework-aware contract — what makes this NOT a copy of the LangChain
adapter:

- CrewAI's :class:`crewai.tools.BaseTool` is an abstract Pydantic v2
  model whose ``_run`` is an :func:`abc.abstractmethod`. Tools created
  via the ``@tool`` decorator are :class:`crewai.tools.base_tool.Tool`
  instances (a concrete subclass) carrying the original function in a
  ``func`` field. This layout differs from LangChain's slot-based
  ``BaseTool.func`` / ``BaseTool.coroutine``:

  * For ``Tool`` instances we re-bind ``func`` (which is a Pydantic
    field, so ``object.__setattr__`` is fine).
  * For arbitrary ``BaseTool`` subclasses with custom ``_run`` we
    monkey-patch ``_run`` on the INSTANCE (NOT the class — that would
    leak into all subclass instances) so the metering wraps the
    method-style execution path.

- CrewAI tools expose ``run()`` (calls ``_run``) and ``arun()``. The
  ``run()`` path is what an agent invokes. Wrapping ``func`` (for
  ``@tool``-built tools) handles the common case; wrapping ``_run`` on
  the instance handles custom subclasses.

- Pydantic v2 model_config controls field assignment. CrewAI's
  ``BaseTool`` allows assignment, but we use ``object.__setattr__`` to
  bypass any future validator-on-assignment that might reject our
  metered callable.
"""

from __future__ import annotations

import inspect
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
          preserved introspection. Compose with CrewAI's ``@tool``
          decorator on top.
        - A :class:`crewai.tools.BaseTool` subclass (incl. ``Tool``
          from ``@tool``): wraps the underlying ``func`` (for ``Tool``)
          or monkey-patches ``_run`` on the INSTANCE (for custom
          subclasses) so the metering fires when the agent calls the
          tool. Returns the same instance.

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

        base_tool_cls = _try_import_base_tool()

        if base_tool_cls is not None and isinstance(target, base_tool_cls):
            wrapped_tool = _wrap_crewai_tool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "crewai.tools.BaseTool; got "
                f"{type(target).__name__}"
            )

        wrapped_func = wrapper(target)
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── BaseTool wrapping ──────────────────────────────────────────────────


def _wrap_crewai_tool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch
    """Wrap a CrewAI BaseTool's execution path in place.

    Two cases:

    1. ``Tool`` instances (from ``@tool`` decorator) carry a ``func``
       field. We re-bind it via ``object.__setattr__`` to bypass
       Pydantic validators-on-assignment and any future immutability.

    2. Custom ``BaseTool`` subclasses override ``_run``. We monkey-patch
       ``_run`` on the INSTANCE (not the class — that would leak to all
       instances of the same subclass). The instance attribute shadows
       the class method during attribute lookup.
    """
    func_attr = getattr(tool, "func", None)

    if func_attr is not None and callable(func_attr):
        # H-CA-1 hostile fix — `func` may carry our marker if the user
        # wrapped the callable before handing it to CrewAI's ``@tool``
        # decorator. Re-wrapping would double-charge every invocation.
        if getattr(func_attr, _METERED_MARKER, False):
            raise RuntimeError(
                "metered_tool: the Tool's underlying `func` is already "
                "metered. Re-wrapping would double-charge every "
                "invocation. Apply metered_tool exactly once per tool."
            )
        # Case 1: @tool-built Tool instance — wrap `func`.
        object.__setattr__(tool, "func", wrapper(func_attr))
        return tool

    # Case 2: Custom BaseTool subclass with overridden `_run`.
    run_method = getattr(tool, "_run", None)
    if run_method is None or not callable(run_method):
        raise TypeError(
            "metered_tool: BaseTool has neither a callable `func` nor "
            "a `_run` method to wrap."
        )
    # Bind the bound method's __func__ so `self` doesn't get double-passed.
    underlying = getattr(run_method, "__func__", run_method)
    if getattr(underlying, _METERED_MARKER, False) or getattr(
        run_method, _METERED_MARKER, False
    ):
        # The user previously monkey-patched a metered _run on the
        # instance. Re-wrap protection is still on the Tool instance
        # via _METERED_MARKER, so this branch only fires if a user
        # bypassed metered_tool() and patched _run themselves with
        # another metered callable.
        raise RuntimeError(
            "metered_tool: the BaseTool's `_run` method is already "
            "metered. Re-wrapping would double-charge every invocation."
        )
    metered = wrapper(underlying)

    if inspect.iscoroutinefunction(underlying):
        async def _async_instance_run(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
            return await metered(tool, *args, **kwargs)

        instance_run: Callable[..., Any] = _async_instance_run
    else:
        def _sync_instance_run(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
            return metered(tool, *args, **kwargs)

        instance_run = _sync_instance_run

    object.__setattr__(tool, "_run", instance_run)
    return tool


# ─── lazy framework import ──────────────────────────────────────────────


def _try_import_base_tool() -> type | None:
    """Return ``crewai.tools.BaseTool`` if importable."""
    try:
        from crewai.tools import BaseTool

        return BaseTool
    except ImportError:  # pragma: no cover — defensive fallback
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
