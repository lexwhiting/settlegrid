"""Pydantic v2 models for SettleGrid SDK request / response shapes.

These are 1:1 ports of the TypeScript SDK types in ``packages/mcp/src/types.ts``.
Field names use Python snake_case while accepting (and emitting) the
TypeScript camelCase wire format via ``alias`` + ``populate_by_name=True``,
so the same JSON payload round-trips losslessly between SDKs.

Hostile pre-checks:

- Strict validation: ``model_config = ConfigDict(strict=True, extra="forbid")``
  means a malformed payload raises ``ValidationError`` rather than silently
  coercing or accepting unexpected fields.
- Non-negative integer guards on cents columns (``Field(ge=0)``).
- Optional fields default to ``None`` and are never serialized when unset
  (``model_dump(exclude_none=True)``) so the wire format matches what the
  TS SDK emits.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    """Common config shared by every wire-shape model."""

    model_config = ConfigDict(
        # Strict typing: reject silent str→int coercion, etc.
        strict=True,
        # Reject extra fields so a schema drift on the server doesn't get
        # silently absorbed into a client model.
        extra="forbid",
        # Allow constructing by either Python name or wire alias; Pydantic
        # v2 default is alias-only when an alias is set.
        populate_by_name=True,
        # Frozen so tests can rely on identity / hashing of model instances.
        frozen=True,
    )


# ─── Request models ──────────────────────────────────────────────────────


class ValidateKeyRequest(_Base):
    """Body of ``POST /api/sdk/validate-key``."""

    api_key: str = Field(min_length=1, alias="apiKey")
    tool_slug: str = Field(min_length=1, alias="toolSlug")


class MeterRequest(_Base):
    """Body of ``POST /api/sdk/meter``.

    Mirrors the Zod schema in
    ``apps/web/src/app/api/sdk/meter/route.ts``. ``consumer_id`` /
    ``tool_id`` / ``key_id`` are required UUIDs sourced from the prior
    :class:`KeyValidationResult` — the server endpoint returns 400
    without them. ``api_key`` was previously sent on the wire but the
    meter endpoint's Zod schema doesn't accept it (Zod silently strips
    it); removed so the Python client matches the TS client's wire
    shape. Since (F2) the server REQUIRES the buyer key as the
    ``X-Api-Key`` request HEADER (``meter/route.ts:59-86``) — the key
    rides the header, never this body (the client passes it via
    ``extra_headers``; see :meth:`settlegrid.client.SettleGrid.meter`).
    """

    tool_slug: str = Field(min_length=1, alias="toolSlug")
    consumer_id: str = Field(min_length=1, alias="consumerId")
    tool_id: str = Field(min_length=1, alias="toolId")
    key_id: str = Field(min_length=1, alias="keyId")
    method: str = Field(min_length=1)
    cost_cents: Annotated[int, Field(ge=0)] = Field(alias="costCents")
    units: Annotated[int, Field(ge=1)] | None = Field(default=None)


# ─── Response models ─────────────────────────────────────────────────────


class KeyValidationResult(_Base):
    """Result of validating a consumer API key.

    Mirrors :ts:type:`KeyValidationResult` from
    ``packages/mcp/src/types.ts`` — at the TS SDK's RUNTIME tolerance,
    not its (looser-than-reality) type declarations. The real
    ``/api/sdk/validate-key`` route emits exactly two shapes
    (``apps/web/src/app/api/sdk/validate-key/route.ts``):

    - success (``:115-123`` test keys, ``:146-153`` normal):
      ``{valid: true, consumerId, toolId, keyId, balanceCents,
      isTestKey}`` — ``isTestKey`` is ALWAYS present.
    - failure (HTTP **200**, ``:63/:70/:75/:80/:87``):
      ``{valid: false, reason}`` — WITHOUT the id/balance fields.

    Hence the id/balance fields are optional: they are ``None`` exactly
    when ``valid`` is ``False`` (callers must check ``valid`` first —
    the wrap pipeline raises :class:`~settlegrid.errors.InvalidKeyError`
    before ever reading them).
    """

    valid: bool
    consumer_id: str | None = Field(default=None, alias="consumerId")
    tool_id: str | None = Field(default=None, alias="toolId")
    key_id: str | None = Field(default=None, alias="keyId")
    balance_cents: Annotated[int, Field(ge=0)] | None = Field(
        default=None, alias="balanceCents"
    )
    is_test_key: bool | None = Field(default=None, alias="isTestKey")
    reason: str | None = Field(default=None)


class MeterResult(_Base):
    """Result of metering (billing) an invocation.

    Mirrors :ts:type:`MeterResult` from ``packages/mcp/src/types.ts`` —
    at the TS SDK's RUNTIME tolerance. The real ``/api/sdk/meter`` route
    emits FOUR distinct success shapes
    (``apps/web/src/app/api/sdk/meter/route.ts``):

    - test-mode (``:181-188``): adds ``billed: false`` +
      ``reason: 'TEST_MODE'``.
    - zero-cost (``:218-223``): the four base fields only.
    - Redis fast path (``:324-329``) — the PRIMARY production path:
      **omits ``invocationId``** (the invocation record is written
      asynchronously) and adds ``isFlagged`` only when flagged.
    - DB fallback (``:415-421``): adds ``isFlagged`` only when flagged.

    Hence ``invocation_id`` is optional (``None`` on the fast path) and
    ``billed``/``reason``/``is_flagged`` are optional extras.
    """

    success: bool
    remaining_balance_cents: Annotated[int, Field(ge=0)] = Field(
        alias="remainingBalanceCents"
    )
    cost_cents: Annotated[int, Field(ge=0)] = Field(alias="costCents")
    invocation_id: str | None = Field(default=None, alias="invocationId")
    billed: bool | None = Field(default=None)
    reason: str | None = Field(default=None)
    is_flagged: bool | None = Field(default=None, alias="isFlagged")


class APIErrorBody(_Base):
    """Non-2xx response body shape from the SettleGrid API.

    Every field is optional because some 4xx responses (e.g., 401 with no
    body, or a non-JSON 5xx from a misconfigured proxy) carry partial
    information. The HTTP layer normalizes these to typed errors.
    """

    # _Base sets extra="forbid" — relax for the error body so unknown
    # fields from a future API version don't break old clients.
    model_config = ConfigDict(
        strict=False,
        extra="ignore",
        populate_by_name=True,
        frozen=True,
    )

    error: str | None = Field(default=None)
    code: str | None = Field(default=None)
    required_cents: int | None = Field(default=None, alias="requiredCents")
    available_cents: int | None = Field(default=None, alias="availableCents")
    top_up_url: str | None = Field(default=None, alias="topUpUrl")
    retry_after_seconds: int | None = Field(
        default=None, alias="retryAfterSeconds"
    )


__all__ = [
    "APIErrorBody",
    "KeyValidationResult",
    "MeterRequest",
    "MeterResult",
    "ValidateKeyRequest",
]
