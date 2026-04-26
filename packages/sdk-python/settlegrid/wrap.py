"""Wrap decorator + context manager for the SettleGrid Python SDK.

The :class:`Wrapper` object returned by :meth:`SettleGrid.wrap` is dual-purpose:

1. **Decorator** — ``@sg.wrap(meter="my-tool", price_cents=10)`` wraps a
   sync or async callable. The decorator detects coroutine functions and
   returns the appropriate wrapper. The wrapped callable accepts an
   optional ``_settlegrid_api_key`` kwarg; if absent it falls back to the
   SDK client's default key. (Buyer-key extraction from request headers /
   MCP metadata lands in P3.PYTHON2 — this scaffold supports the
   single-tenant case.)

2. **Context manager** — both sync (``with sg.wrap(...) as inv``) and
   async (``async with sg.wrap(...) as inv``). The context manager meters
   the call on exit *unless* :meth:`Invocation.void` was called or an
   exception escaped the block. Voiding releases the reservation without
   charging.

Hostile pre-checks:

- Sync vs async detection uses :func:`inspect.iscoroutinefunction`, which
  correctly handles ``functools.wraps``-decorated coroutines and
  ``async def``-defined free functions. Mixing the two is a programming
  error and raises ``TypeError`` at wrap time.
- The decorator preserves the wrapped function's ``__name__``,
  ``__doc__``, ``__module__``, and signature via :func:`functools.wraps`.
- Re-entering the same context manager is rejected with ``RuntimeError``
  so a single :class:`Invocation` instance can't accidentally double-charge.
"""

from __future__ import annotations

import functools
import inspect
import threading
from collections.abc import Awaitable, Callable
from types import TracebackType
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

if TYPE_CHECKING:
    from .client import SettleGrid

# Argument names reserved by the SDK on wrapped callables. A user
# function that already takes ``_settlegrid_api_key`` would silently
# collide with this, so the wrapper pops them before calling through.
_RESERVED_KWARG = "_settlegrid_api_key"

F = TypeVar("F", bound=Callable[..., Any])


class Invocation:
    """Per-call state for the context-manager flow.

    Created by :class:`Wrapper.__enter__` / :class:`Wrapper.__aenter__`.
    Tracks whether the caller voided the invocation so the exit handler
    knows to skip the meter call.

    The three UUIDs (``consumer_id`` / ``tool_id`` / ``key_id``) come
    from the :class:`KeyValidationResult` produced when the context
    manager opens; they are required by the meter endpoint and are
    captured here so the exit handler can forward them without re-
    validating.
    """

    meter: str
    price_cents: int
    api_key: str | None
    consumer_id: str
    tool_id: str
    key_id: str

    def __init__(
        self,
        meter: str,
        price_cents: int,
        api_key: str | None,
        consumer_id: str,
        tool_id: str,
        key_id: str,
    ) -> None:
        self.meter = meter
        self.price_cents = price_cents
        self.api_key = api_key
        self.consumer_id = consumer_id
        self.tool_id = tool_id
        self.key_id = key_id
        self._voided = False
        self._charged = False
        self._lock = threading.Lock()

    @property
    def voided(self) -> bool:
        """``True`` if :meth:`void` was called."""
        with self._lock:
            return self._voided

    @property
    def charged(self) -> bool:
        """``True`` once the invocation has been metered."""
        with self._lock:
            return self._charged

    def void(self) -> None:
        """Mark the invocation void — the exit handler skips metering.

        Idempotent; calling twice is fine. Useful when a caller decides
        mid-flight that no charge should land (e.g., a downstream service
        returned an empty result).
        """
        with self._lock:
            if self._charged:
                raise RuntimeError(
                    "cannot void an invocation that has already been charged"
                )
            self._voided = True

    def _mark_charged(self) -> None:
        """Internal — flip ``charged=True`` once metering completes."""
        with self._lock:
            self._charged = True


class Wrapper:
    """Dual-mode wrap returned by :meth:`SettleGrid.wrap`.

    See module docstring for usage. The class is intentionally callable
    (decorator) AND implements the ``with`` / ``async with`` protocols
    (context manager).
    """

    meter: str
    price_cents: int
    api_key: str | None
    _sg: SettleGrid

    def __init__(
        self,
        sg: SettleGrid,
        meter: str,
        price_cents: int,
        api_key: str | None = None,
    ) -> None:
        if not isinstance(meter, str) or not meter.strip():
            raise ValueError(
                f"sg.wrap requires a non-empty `meter` string; got {meter!r}"
            )
        if not isinstance(price_cents, int) or isinstance(price_cents, bool):
            raise TypeError(
                f"sg.wrap requires `price_cents` as int; got {type(price_cents).__name__}"
            )
        if price_cents < 0:
            raise ValueError(
                f"sg.wrap requires `price_cents` >= 0; got {price_cents}"
            )
        # H4 hostile fix — when `api_key` is provided, it must be a
        # non-empty string. Surface bad shapes at wrap-time rather than
        # at call-time when the failure mode is harder to debug.
        if api_key is not None and (
            not isinstance(api_key, str) or not api_key.strip()
        ):
            raise ValueError(
                "sg.wrap `api_key` (when provided) must be a non-empty "
                f"string; got {api_key!r}"
            )
        self._sg = sg
        self.meter = meter
        self.price_cents = price_cents
        self.api_key = api_key
        # ``_active`` guards against re-entering the same instance as a
        # context manager twice.
        self._active = False
        self._invocation: Invocation | None = None

    # ─── decorator ───────────────────────────────────────────────────

    def __call__(self, func: F) -> F:
        """Wrap a function. Async-aware via :func:`inspect.iscoroutinefunction`."""
        if not callable(func):
            raise TypeError(
                f"sg.wrap decorator target must be callable; got {type(func).__name__}"
            )
        if inspect.iscoroutinefunction(func):
            return cast(F, self._wrap_async(func))
        return cast(F, self._wrap_sync(func))

    def _wrap_sync(self, func: Callable[..., Any]) -> Callable[..., Any]:
        # H1 hostile fix — TS SDK pattern is: auth (cached) → handler →
        # meter. If the handler raises, the meter call is skipped so the
        # consumer is never charged for an invocation that produced no
        # result. The cache makes the validate_key call free after the
        # first hit per (api_key) within the TTL window.
        sg = self._sg
        meter_name = self.meter
        price_cents = self.price_cents
        default_api_key = self.api_key

        @functools.wraps(func)
        def sync_inner(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401 — generic decorator forwards
            from .errors import InvalidKeyError  # local import — keep wrap.py decoupled

            api_key = (
                kwargs.pop(_RESERVED_KWARG, None)
                or default_api_key
                or sg.api_key
            )
            # 1. Auth check (cached). The validation result carries the
            #    consumer / tool / key UUIDs the meter endpoint requires;
            #    capture them so step 3 can forward them.
            validation = sg.validate_key(api_key)
            if not validation.valid:
                raise InvalidKeyError()
            # 2. Handler. If it raises, meter is skipped — no charge for
            #    failed invocations (matches TS execute() semantics).
            result = func(*args, **kwargs)
            # 3. Meter on success — thread the validation UUIDs through.
            sg.meter(
                api_key,
                method=meter_name,
                cost_cents=price_cents,
                consumer_id=validation.consumer_id,
                tool_id=validation.tool_id,
                key_id=validation.key_id,
            )
            return result

        return sync_inner

    def _wrap_async(
        self, func: Callable[..., Awaitable[Any]]
    ) -> Callable[..., Awaitable[Any]]:
        sg = self._sg
        meter_name = self.meter
        price_cents = self.price_cents
        default_api_key = self.api_key

        @functools.wraps(func)
        async def async_inner(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401 — generic decorator forwards
            from .errors import InvalidKeyError

            api_key = (
                kwargs.pop(_RESERVED_KWARG, None)
                or default_api_key
                or sg.api_key
            )
            # H1 hostile fix — see _wrap_sync for ordering rationale.
            # Capture validation UUIDs so the meter call can forward them
            # (the meter endpoint requires consumerId / toolId / keyId).
            validation = await sg.validate_key_async(api_key)
            if not validation.valid:
                raise InvalidKeyError()
            result = await func(*args, **kwargs)
            await sg.meter_async(
                api_key,
                method=meter_name,
                cost_cents=price_cents,
                consumer_id=validation.consumer_id,
                tool_id=validation.tool_id,
                key_id=validation.key_id,
            )
            return result

        return async_inner

    # ─── sync context manager ───────────────────────────────────────

    def __enter__(self) -> Invocation:
        # H2 hostile fix — validate the buyer key on entry so a bad key
        # short-circuits BEFORE the user runs work inside the block.
        # Matches TS execute() ordering: auth → handler → meter.
        from .errors import InvalidKeyError

        self._guard_reentry()
        api_key = self.api_key or self._sg.api_key
        validation = self._sg.validate_key(api_key)
        if not validation.valid:
            raise InvalidKeyError()
        self._active = True
        self._invocation = Invocation(
            meter=self.meter,
            price_cents=self.price_cents,
            api_key=api_key,
            consumer_id=validation.consumer_id,
            tool_id=validation.tool_id,
            key_id=validation.key_id,
        )
        return self._invocation

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        try:
            self._meter_or_void_sync(exc is not None)
        finally:
            self._active = False
            self._invocation = None
        # Don't suppress exceptions — propagate through.
        return False

    # ─── async context manager ──────────────────────────────────────

    async def __aenter__(self) -> Invocation:
        # H2 hostile fix — see __enter__ for rationale.
        from .errors import InvalidKeyError

        self._guard_reentry()
        api_key = self.api_key or self._sg.api_key
        validation = await self._sg.validate_key_async(api_key)
        if not validation.valid:
            raise InvalidKeyError()
        self._active = True
        self._invocation = Invocation(
            meter=self.meter,
            price_cents=self.price_cents,
            api_key=api_key,
            consumer_id=validation.consumer_id,
            tool_id=validation.tool_id,
            key_id=validation.key_id,
        )
        return self._invocation

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        try:
            await self._meter_or_void_async(exc is not None)
        finally:
            self._active = False
            self._invocation = None
        return False

    # ─── internals ──────────────────────────────────────────────────

    def _guard_reentry(self) -> None:
        if self._active:
            raise RuntimeError(
                "Wrapper context manager is not re-entrant — a single "
                "wrap() result can't be opened twice in parallel. Open a "
                "fresh sg.wrap(...) per invocation instead."
            )

    def _meter_or_void_sync(self, raised: bool) -> None:
        inv = self._invocation
        if inv is None:
            return
        # Skip metering on (a) caller voided, or (b) the user code raised.
        # The TS SDK treats raised exceptions as auto-void to mirror
        # "you-pay-only-for-success" semantics.
        if inv.voided or raised:
            return
        if inv.api_key is None:
            return  # Defensive — caught at construction time, but explicit.
        self._sg.meter(
            inv.api_key,
            method=inv.meter,
            cost_cents=inv.price_cents,
            consumer_id=inv.consumer_id,
            tool_id=inv.tool_id,
            key_id=inv.key_id,
        )
        inv._mark_charged()

    async def _meter_or_void_async(self, raised: bool) -> None:
        inv = self._invocation
        if inv is None:
            return
        if inv.voided or raised:
            return
        if inv.api_key is None:
            return
        await self._sg.meter_async(
            inv.api_key,
            method=inv.meter,
            cost_cents=inv.price_cents,
            consumer_id=inv.consumer_id,
            tool_id=inv.tool_id,
            key_id=inv.key_id,
        )
        inv._mark_charged()


__all__ = ["Invocation", "Wrapper"]
