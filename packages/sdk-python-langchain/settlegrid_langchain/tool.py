"""``metered_tool`` decorator — wrap a LangChain tool or callable with
SettleGrid pay-per-call metering.

Two surfaces are supported:

1. **Callable target** (sync or async function). Returns a wrapped
   callable with the same name / signature / docstring. Compose with
   LangChain's ``@tool`` decorator on top::

       @tool
       @metered_tool(sg, meter="search", price_cents=10)
       def search(query: str) -> str:
           '''Search the web.'''
           return f"results for {query}"

2. **``BaseTool`` instance** (e.g., the result of ``@tool`` or a
   manually-constructed ``StructuredTool``). The tool's underlying
   ``func`` (or ``coroutine``) is replaced with the metered version.
   Returns the same ``BaseTool`` object so existing references stay
   live::

       my_tool = StructuredTool.from_function(search_fn, ...)
       metered_tool(sg, meter="search", price_cents=10)(my_tool)

Hostile pre-checks:

- ``functools.wraps`` preserves ``__name__``, ``__doc__``,
  ``__module__``, and the wrapped signature so LangChain's tool
  introspection (which reads docstring → description, signature →
  args_schema) still works.
- Async detection is via :func:`inspect.iscoroutinefunction`. A
  ``BaseTool`` with both ``func`` and ``coroutine`` set has both wrapped.
- The ``meter`` and ``price_cents`` kwargs are validated at decoration
  time (delegated to :class:`settlegrid.Wrapper`'s constructor) so
  malformed config surfaces as a ``ValueError`` / ``TypeError`` *before*
  the agent runs.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import suppress
from typing import TYPE_CHECKING, Any, TypeVar, cast

if TYPE_CHECKING:
    from settlegrid import SettleGrid

# We import ``BaseTool`` lazily inside the decorator to avoid forcing
# ``langchain_core`` as a hard runtime dependency when the user only
# passes plain callables. The import lives behind a guarded try/except
# so the package is still useful in environments without LangChain.

F = TypeVar("F", bound=Callable[..., Any])

# Sentinel attached to every wrapped target so re-applying metered_tool
# is detected and rejected. Catches the common mistake of decorating a
# tool twice (which would double-meter every invocation).
_METERED_MARKER = "__settlegrid_metered__"

# Module-level default SettleGrid client. Set via :func:`configure`.
# Allows the spec's literal ``metered_tool(meter, price_cents)`` form
# to work without threading the client through every call site.
_default_client: SettleGrid | None = None


def configure(sg: SettleGrid) -> None:
    """Set the module-level default :class:`SettleGrid` client.

    Once configured, :func:`metered_tool` may be called without an
    explicit ``sg`` argument — it falls back to the default client.

    Example::

        from settlegrid import SettleGrid
        from settlegrid_langchain import configure, metered_tool

        configure(SettleGrid(api_key="sg_live_seller", tool_slug="my-tool"))

        @metered_tool(meter="search", price_cents=10)
        def search(query: str) -> str:
            '''Search the web.'''
            return f"results for {query}"

    Re-calling ``configure`` with a different client replaces the
    default; existing decorated functions keep their original client
    (the binding happens at decoration time).
    """
    global _default_client
    if not hasattr(sg, "wrap") or not callable(sg.wrap):
        raise TypeError(
            "configure: argument must be a SettleGrid instance (got "
            f"{type(sg).__name__})."
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
        sg: A :class:`settlegrid.SettleGrid` instance. Optional if
            :func:`configure` has set a module-level default — passing
            no ``sg`` and no default raises :class:`RuntimeError`.
        meter: Method / tool slug recorded in SettleGrid for billing.
            Must be a non-empty string.
        price_cents: Per-invocation cost in cents. Must be a non-negative
            ``int``. ``bool`` is rejected (``True`` is an ``int``
            subclass and would silently pass otherwise).
        api_key: Optional buyer-side default key used when the wrapped
            callable is invoked without an explicit
            ``_settlegrid_api_key`` kwarg. Falls back to ``sg.api_key``
            (the seller's own key) if neither is provided.

    Returns:
        A decorator that accepts either:

        - A sync or async callable: returns a wrapped callable with
          identical ``__name__`` / ``__doc__`` / ``__module__`` /
          signature.
        - A ``langchain_core.tools.BaseTool`` instance: replaces its
          ``func`` and ``coroutine`` slots in-place and returns the
          same object.

    Raises:
        TypeError: If ``meter`` is not a string, ``price_cents`` is not
            an ``int``, ``api_key`` (when provided) is not a string, or
            the decorator target is neither callable nor a ``BaseTool``.
        ValueError: If ``meter`` is empty / whitespace, ``price_cents``
            is negative, or ``api_key`` is empty / whitespace.
        RuntimeError: If neither ``sg`` is provided nor a default has
            been configured.
    """
    # D1 spec-diff fix — accept the literal spec signature
    # `metered_tool(meter, price_cents)` by falling back to a
    # module-level default client.
    if sg is None:
        sg = _default_client
        if sg is None:
            raise RuntimeError(
                "metered_tool: no SettleGrid client. Either pass `sg` "
                "explicitly (`metered_tool(sg, meter=..., price_cents=...)`) "
                "or configure a default first "
                "(`configure(SettleGrid(api_key=...))`)."
            )

    # H10/H11 hostile fix — validate `sg` has the expected interface.
    # Catches `@metered_tool` (missing parens) where sg accidentally
    # becomes the user's function, and any other shape mismatch.
    if not hasattr(sg, "wrap") or not callable(sg.wrap):
        raise TypeError(
            "metered_tool: first arg must be a SettleGrid instance "
            "(got "
            f"{type(sg).__name__}). If you meant to decorate without "
            "args, you forgot the parens — write "
            "`@metered_tool(sg, meter=..., price_cents=...)`."
        )

    # Construct the Wrapper up-front so misconfiguration surfaces here,
    # not on first invocation. ``SettleGrid.wrap`` validates the args.
    wrapper = sg.wrap(meter=meter, price_cents=price_cents, api_key=api_key)

    def decorator(target: F) -> F:
        # H4/H5 hostile fix — refuse to re-wrap an already-metered target.
        if getattr(target, _METERED_MARKER, False):
            raise RuntimeError(
                "metered_tool: target is already metered. Re-wrapping "
                "would double-charge every invocation. Apply metered_tool "
                "exactly once per tool."
            )

        # Lazy import — only when the user actually decorates a BaseTool.
        base_tool_cls = _try_import_basetool()

        if base_tool_cls is not None and isinstance(target, base_tool_cls):
            wrapped_tool = _wrap_basetool(target, wrapper)
            object.__setattr__(wrapped_tool, _METERED_MARKER, True)
            return cast(F, wrapped_tool)

        if not callable(target):
            raise TypeError(
                "metered_tool target must be a callable or a "
                "langchain_core.tools.BaseTool; got "
                f"{type(target).__name__}"
            )

        # ``Wrapper.__call__`` already preserves __name__, __doc__,
        # signature via functools.wraps, and dispatches sync vs async
        # via inspect.iscoroutinefunction. Reuse that.
        wrapped_func = wrapper(target)
        # Mark the wrapped function so re-decoration is rejected.
        # Some callable types (e.g., builtin_function_or_method) reject
        # arbitrary attribute assignment. Skip the marker silently in
        # those cases — the re-wrap protection is best-effort.
        # In practice, Wrapper.__call__ always returns a Python function
        # that accepts attribute assignment, so this never fires.
        with suppress(AttributeError, TypeError):
            wrapped_func.__settlegrid_metered__ = True  # type: ignore[attr-defined]
        return wrapped_func

    return decorator


# ─── BaseTool wrapping ──────────────────────────────────────────────────


def _wrap_basetool(tool: Any, wrapper: Any) -> Any:  # noqa: ANN401 — generic dispatch over BaseTool subclasses
    """Replace the tool's ``func`` / ``coroutine`` in-place.

    LangChain's ``BaseTool`` exposes two execution slots:

    - ``func`` — sync callable invoked by ``BaseTool._run`` / ``invoke``.
    - ``coroutine`` — async callable invoked by ``BaseTool._arun`` /
      ``ainvoke``.

    A tool may have one or both (e.g., ``@tool`` on a sync function
    populates ``func``; on an async function populates ``coroutine``;
    constructing a ``StructuredTool`` directly may populate both).

    The decorator wraps each slot that exists. The original tool's
    ``name``, ``description``, ``args_schema``, ``return_direct`` and
    other introspection-relevant fields stay untouched.
    """
    sync_func = getattr(tool, "func", None)
    async_func = getattr(tool, "coroutine", None)

    if sync_func is None and async_func is None:
        raise TypeError(
            "metered_tool: BaseTool subclass has neither `func` nor "
            "`coroutine` set — nothing to wrap. Construct your tool "
            "with at least one of them."
        )

    # H1 hostile fix — wrap whichever slot is set, REGARDLESS of whether
    # its function is sync or async. Wrapper.__call__ already dispatches
    # sync vs async via `inspect.iscoroutinefunction`, so passing through
    # produces the right wrapper either way. The previous "skip if slot
    # type doesn't match" logic was a silent no-op landmine: a tool with
    # an async function in `func` (programmatic mistake) would never get
    # metered.
    #
    # Pydantic v2 BaseTool subclasses are frozen by default; LangChain's
    # BaseTool overrides this and allows field assignment, but we use
    # `object.__setattr__` defensively so a future LangChain change to
    # make fields immutable doesn't silently break this path.
    if sync_func is not None:
        object.__setattr__(tool, "func", wrapper(sync_func))
    if async_func is not None:
        object.__setattr__(tool, "coroutine", wrapper(async_func))

    return tool


# ─── lazy LangChain import ──────────────────────────────────────────────


def _try_import_basetool() -> type | None:
    """Return ``langchain_core.tools.BaseTool`` if importable, else None.

    Lazy + cached so:

    - Users who only decorate plain callables don't pay the import cost
      (LangChain pulls in pydantic + a stack of optional deps).
    - The package functions in environments without ``langchain_core``
      installed (it's still listed as a runtime dep, but a partial
      install or an SDK-only consumer should not crash on import).
    """
    try:
        from langchain_core.tools import BaseTool

        return BaseTool
    except ImportError:  # pragma: no cover — defensive fallback for SDK-only consumers
        return None


__all__ = ["configure", "get_default_client", "metered_tool", "reset_default_client"]
