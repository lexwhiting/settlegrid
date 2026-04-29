"""``metered_tool`` decorator for DSPy.

Framework-aware contract — what makes this NOT a copy of the LangChain
adapter:

- DSPy's :class:`dspy.Tool` is a Pydantic v2 :class:`BaseModel` (under
  ``dspy.adapters.types.tool``) that holds the callable in a ``func``
  field. Both dispatch surfaces — sync ``tool(**kwargs)`` and async
  ``await tool.acall(**kwargs)`` — read ``self.func`` *live* (verified
  by inspecting ``dspy.Tool.__call__`` and ``dspy.Tool.acall``: each
  call does ``result = self.func(**parsed_kwargs)``, no captured
  reference). So a single ``object.__setattr__(tool, "func", wrapped)``
  is enough to meter both paths — no FunctionSchema-style cache trap
  like Pydantic AI's.

- ``dspy.Tool`` extends Pydantic's ``BaseModel``. Field assignment is
  permitted by default, but we use ``object.__setattr__`` defensively
  in case a future DSPy release adds frozen / validate-on-assignment
  config — the raw setattr writes to ``__dict__`` and bypasses
  Pydantic's ``__setattr__`` override.

- DSPy auto-introspects the function via ``dspy.Tool.__init__`` to
  derive ``args`` / ``arg_types`` / ``arg_desc`` from the signature
  + docstring at construction time. Those derived fields stay on the
  tool object after our wrap; the new ``func`` preserves the original
  signature (functools.wraps), so the cached schema remains accurate.
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
          preserved ``__name__`` / ``__doc__`` / signature so DSPy's
          signature-based introspection still works.
        - A :class:`dspy.Tool` instance: rebinds the ``func`` field via
          :meth:`object.__setattr__` (Pydantic v2 BaseModel) and returns
          the same instance.

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
            wrapped_tool = _wrap_dspy_tool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "dspy.Tool; got "
                f"{type(target).__name__}"
            )

        wrapped_func = wrapper(target)
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── Tool wrapping ──────────────────────────────────────────────────────


def _wrap_dspy_tool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch
    """Re-bind a ``dspy.Tool``'s ``func`` field in place.

    DSPy's ``Tool`` is a Pydantic v2 BaseModel. Both ``__call__`` (sync)
    and ``acall`` (async) read ``self.func`` live, so a single rebind
    meters both dispatch surfaces. The marker on the underlying ``func``
    is checked first to refuse the wrap-callable-then-build-Tool-then-
    rewrap-Tool path that would otherwise double-meter every call.
    """
    fn = getattr(tool, "func", None)
    if fn is None or not callable(fn):
        raise TypeError(
            "metered_tool: dspy.Tool has no callable `func` field — "
            "nothing to wrap."
        )
    if getattr(fn, _METERED_MARKER, False):
        raise RuntimeError(
            "metered_tool: the Tool's underlying `func` is already "
            "metered. Re-wrapping would double-charge every invocation. "
            "Apply metered_tool exactly once per tool."
        )
    object.__setattr__(tool, "func", wrapper(fn))
    return tool


# ─── lazy framework import ──────────────────────────────────────────────


def _try_import_tool() -> type | None:
    """Return ``dspy.Tool`` if importable."""
    try:
        # dspy ships without py.typed (DSPy 3.x); treat the import as
        # untyped and surface it to mypy as a concrete `type`.
        from dspy import Tool  # type: ignore[import-untyped]

        return cast(type, Tool)
    except ImportError:  # pragma: no cover — defensive fallback
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
