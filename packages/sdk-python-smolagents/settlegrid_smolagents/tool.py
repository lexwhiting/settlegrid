"""``metered_tool`` decorator for smolagents.

Framework-aware contract — what makes this NOT a copy of the LangChain
adapter:

- smolagents' :class:`smolagents.Tool` is an :class:`abc.ABC` (no
  Pydantic). The dispatch path is ``tool(*args, **kwargs)`` →
  ``Tool.__call__`` → ``self.forward(*args, **kwargs)``. ``forward``
  is the abstract method subclasses implement.

- The ``@tool`` decorator produces a ``SimpleTool`` instance whose
  ``forward`` is the user's function — stored as a regular
  *instance attribute* (not a bound method). Replacing it with
  ``object.__setattr__(tool, "forward", wrapped_fn)`` is enough to
  re-route every dispatch.

- A custom :class:`Tool` subclass overrides ``forward`` as a class
  method. Patching ``forward`` at the *instance* level shadows the
  class method during attribute lookup, so the metering wraps the
  method-style execution path without leaking into other instances of
  the same subclass.

- smolagents has no async dispatch surface (``Tool.__call__`` is sync;
  there is no ``acall`` / ``arun`` / equivalent). We wrap a sync
  callable per slot — async smolagents tools don't exist as of 1.24.
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

        - A sync callable: returns a wrapped callable with preserved
          introspection.
        - A :class:`smolagents.Tool` subclass instance (incl. the
          ``SimpleTool`` produced by ``@tool``): patches ``forward`` on
          the instance so the metering fires when ``Tool.__call__``
          dispatches. Returns the same instance.

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
            wrapped_tool = _wrap_smolagents_tool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "smolagents.Tool; got "
                f"{type(target).__name__}"
            )

        wrapped_func = wrapper(target)
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── Tool wrapping ──────────────────────────────────────────────────────


def _wrap_smolagents_tool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch
    """Patch a smolagents Tool's ``forward`` method on the instance.

    Two cases land in the same code path because both produce a
    ``forward`` attribute on the instance:

    1. ``@tool``-built ``SimpleTool`` — ``forward`` is a regular
       function stored in the instance ``__dict__``. Replacing it via
       ``object.__setattr__`` is straightforward.

    2. Custom :class:`Tool` subclass — ``forward`` is a class-level
       method. Setting it at the instance level shadows the class
       method (Python attribute lookup checks the instance dict first).
       We bind ``tool`` in a closure and pass it through as ``self`` so
       the original method semantics are preserved.

    Re-wrap protection: the underlying ``forward`` may carry the
    ``_METERED_MARKER`` if the user wrapped a callable separately and
    then handed it to ``@tool`` / a Tool subclass. Detect and refuse
    rather than compose two metering layers (cf. HH-PA-2 / H-CA-1
    lessons from P3.PYTHON4).
    """
    forward = getattr(tool, "forward", None)
    if forward is None or not callable(forward):
        raise TypeError(
            "metered_tool: smolagents.Tool has no callable `forward` "
            "method — nothing to wrap."
        )

    # Bound method on a custom subclass: peel off ``__func__`` so we don't
    # double-pass ``self`` through the metering wrapper. ``@tool``-built
    # SimpleTool stores forward as a plain function in __dict__ (no
    # __func__) — same pathway, no extra unbinding needed.
    underlying = getattr(forward, "__func__", forward)
    is_bound_method = underlying is not forward

    if getattr(underlying, _METERED_MARKER, False) or getattr(
        forward, _METERED_MARKER, False
    ):
        raise RuntimeError(
            "metered_tool: the Tool's `forward` method is already "
            "metered. Re-wrapping would double-charge every invocation. "
            "Apply metered_tool exactly once per tool."
        )

    metered = wrapper(underlying)

    if is_bound_method:
        # Custom Tool subclass — `forward` was a bound class method, so
        # `metered` expects ``self`` first. Capture ``tool`` in a closure
        # and forward through.
        # smolagents has no async path as of 1.24, so this branch is
        # forward-compatible scaffolding rather than a tested path.
        if inspect.iscoroutinefunction(underlying):  # pragma: no cover
            async def _async_instance_forward(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
                return await metered(tool, *args, **kwargs)

            instance_forward: Callable[..., Any] = _async_instance_forward
        else:
            def _sync_instance_forward(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
                return metered(tool, *args, **kwargs)

            instance_forward = _sync_instance_forward
    else:
        # SimpleTool (@tool-built) — forward is already an instance attr
        # (a plain function). The metered wrapper already preserves the
        # original signature via functools.wraps; just bind it in place.
        instance_forward = metered

    object.__setattr__(tool, "forward", instance_forward)
    return tool


# ─── lazy framework import ──────────────────────────────────────────────


def _try_import_tool() -> type | None:
    """Return ``smolagents.Tool`` if importable."""
    try:
        # smolagents ships without py.typed (1.24); treat the import as
        # untyped and surface it to mypy as a concrete `type`.
        from smolagents import Tool  # type: ignore[import-untyped]

        return cast(type, Tool)
    except ImportError:  # pragma: no cover — defensive fallback
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
