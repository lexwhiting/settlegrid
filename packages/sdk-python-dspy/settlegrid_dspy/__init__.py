"""DSPy adapter for SettleGrid.

Public API: :func:`metered_tool` — decorator that wraps a callable or
``dspy.Tool`` instance with SettleGrid pay-per-call metering. Pinned to
DSPy 3.2.x in pyproject.toml because DSPy's tool API is less stable
than the mainstream frameworks.
"""

from __future__ import annotations

from .tool import configure, get_default_client, metered_tool, reset_default_client

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "configure",
    "get_default_client",
    "metered_tool",
    "reset_default_client",
]
