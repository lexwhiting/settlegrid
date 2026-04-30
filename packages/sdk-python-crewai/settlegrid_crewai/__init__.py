"""CrewAI adapter for SettleGrid.

Public API: :func:`metered_tool` — decorator that wraps a callable or
``crewai.tools.BaseTool`` subclass with SettleGrid pay-per-call metering.
Built as a thin layer over :class:`settlegrid.SettleGrid.wrap`. Adapted
to CrewAI's abstract ``_run`` method model.
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
