"""SettleGrid Python SDK — public surface.

1:1 port of the TypeScript ``@settlegrid/mcp`` SDK.

See :mod:`settlegrid.client` for the entry point and :mod:`settlegrid.errors`
for the typed error hierarchy. Internal modules (``_http``, ``_types``) are
not part of the stable surface and may change between releases.
"""

from __future__ import annotations

from ._types import (
    APIErrorBody,
    KeyValidationResult,
    MeterRequest,
    MeterResult,
    ValidateKeyRequest,
)
from .cache import (
    DEFAULT_MAX_SIZE,
    DEFAULT_TTL_SECONDS,
    KeyValidationCache,
    LRUCache,
)
from .client import SDK_VERSION, SettleGrid
from .errors import (
    BudgetExceededError,
    InsufficientCreditsError,
    InvalidKeyError,
    NetworkError,
    RateLimitedError,
    SettleGridError,
    SettleGridErrorCode,
    SettleGridUnavailableError,
    TimeoutError,
    ToolDisabledError,
    ToolNotFoundError,
)
from .wrap import Invocation, Wrapper

__version__ = SDK_VERSION

__all__ = [
    # Version
    "SDK_VERSION",
    "__version__",
    # Client + wrap surface
    "SettleGrid",
    "Wrapper",
    "Invocation",
    # Error classes
    "SettleGridError",
    "SettleGridErrorCode",
    "InvalidKeyError",
    "InsufficientCreditsError",
    "BudgetExceededError",
    "ToolNotFoundError",
    "ToolDisabledError",
    "RateLimitedError",
    "SettleGridUnavailableError",
    "NetworkError",
    "TimeoutError",
    # Pydantic models
    "ValidateKeyRequest",
    "MeterRequest",
    "KeyValidationResult",
    "MeterResult",
    "APIErrorBody",
    # Cache
    "LRUCache",
    "KeyValidationCache",
    "DEFAULT_MAX_SIZE",
    "DEFAULT_TTL_SECONDS",
]
