"""``metered_tool`` decorator for LlamaIndex.

Framework-aware contract — what makes this NOT a copy of the LangChain
adapter:

- LlamaIndex's :class:`llama_index.core.tools.FunctionTool` carries the
  callable in two READ-ONLY slots: ``fn`` (sync, exposed via property)
  and ``async_fn`` (async, also a property). The TS-style "set ``func``
  in place" pattern from LangChain doesn't compile here. Instead, we
  rebuild the FunctionTool around the metered callable using
  :meth:`FunctionTool.from_defaults`, preserving the original
  ``ToolMetadata`` (``name``, ``description``, ``fn_schema``,
  ``return_direct``).

- LlamaIndex tools expose ``call`` / ``acall`` (NOT ``invoke``/``ainvoke``)
  so the agent loop talks to a different surface than LangChain's
  ``BaseTool``. The metering is applied to ``fn``/``async_fn`` so it
  fires for both ``call`` paths.

- LlamaIndex's ``ToolMetadata`` is a structured dataclass — preserving
  it (vs. relying on docstring + signature inference like LangChain's
  ``@tool``) is the documented introspection contract.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import suppress
from typing import TYPE_CHECKING, Any, TypeVar, cast

if TYPE_CHECKING:
    from settlegrid import SettleGrid


F = TypeVar("F", bound=Callable[..., Any])

# Re-wrap protection — same pattern as the LangChain adapter.
_METERED_MARKER = "__settlegrid_metered__"

# Module-level default SettleGrid client.
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

        - A sync or async callable: returns the wrapped callable with
          preserved ``__name__`` / ``__doc__`` / signature so
          :meth:`FunctionTool.from_defaults` can introspect it.
        - A :class:`FunctionTool` instance: returns a NEW FunctionTool
          rebuilt with the metered callable in the fn slot, preserving
          the original ``metadata`` (name, description, fn_schema,
          return_direct).

    Raises:
        TypeError: If ``sg`` shape is wrong or target is neither a
            callable nor a FunctionTool.
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

        function_tool_cls = _try_import_function_tool()

        if function_tool_cls is not None and isinstance(target, function_tool_cls):
            wrapped_tool = _wrap_function_tool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "llama_index.core.tools.FunctionTool; got "
                f"{type(target).__name__}"
            )

        wrapped_func = wrapper(target)
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── FunctionTool wrapping ──────────────────────────────────────────────


def _wrap_function_tool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch
    """Rebuild ``FunctionTool`` around the metered fn / async_fn.

    LlamaIndex's ``FunctionTool.fn`` / ``async_fn`` are read-only
    properties — we cannot mutate the slots in place the way we do for
    LangChain's BaseTool. Instead, construct a new FunctionTool via
    :meth:`from_defaults`, threading through the metered callables and
    the original ``ToolMetadata`` so the rebuilt tool is functionally
    indistinguishable from the original except for the metering.
    """
    # Local import — keep llama_index optional at module load time.
    from llama_index.core.tools import FunctionTool  # noqa: I001

    metadata = tool.metadata
    sync_fn = getattr(tool, "fn", None)
    async_fn = getattr(tool, "async_fn", None)

    if sync_fn is None and async_fn is None:
        raise TypeError(
            "metered_tool: FunctionTool has neither `fn` nor `async_fn` set "
            "— nothing to wrap."
        )

    # H-LI-1 hostile fix — the FunctionTool itself isn't carrying our
    # marker yet, but its underlying ``fn`` / ``async_fn`` may have been
    # wrapped earlier (user wrapped a callable, then handed it to
    # ``FunctionTool.from_defaults``). Re-wrapping would compose two
    # metering layers and double-meter every call.
    if (sync_fn is not None and getattr(sync_fn, _METERED_MARKER, False)) or (
        async_fn is not None and getattr(async_fn, _METERED_MARKER, False)
    ):
        raise RuntimeError(
            "metered_tool: the FunctionTool's underlying callable is "
            "already metered. Re-wrapping would double-charge every "
            "invocation. Apply metered_tool exactly once per tool."
        )

    metered_sync = wrapper(sync_fn) if sync_fn is not None else None
    metered_async = wrapper(async_fn) if async_fn is not None else None

    # HH-LI-2 hostile fix — preserve every ``from_defaults`` kwarg that
    # the original tool was constructed with. The previous version only
    # forwarded name / description / fn_schema / return_direct, silently
    # dropping ``callback`` / ``async_callback`` / ``partial_params``
    # (and any future additions). Read the underscore-prefixed private
    # attrs LlamaIndex stores them under, defaulting to None so we don't
    # crash on older versions that pre-date a given field.
    callback = getattr(tool, "_callback", None)
    async_callback = getattr(tool, "_async_callback", None)
    partial_params = getattr(tool, "partial_params", None) or None
    return FunctionTool.from_defaults(
        fn=metered_sync,
        async_fn=metered_async,
        name=metadata.name,
        description=metadata.description,
        return_direct=metadata.return_direct,
        fn_schema=metadata.fn_schema,
        callback=callback,
        async_callback=async_callback,
        partial_params=partial_params,
    )


# ─── lazy framework import ──────────────────────────────────────────────


def _try_import_function_tool() -> type | None:
    """Return ``llama_index.core.tools.FunctionTool`` if importable."""
    try:
        from llama_index.core.tools import FunctionTool

        return FunctionTool
    except ImportError:  # pragma: no cover — defensive fallback
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
