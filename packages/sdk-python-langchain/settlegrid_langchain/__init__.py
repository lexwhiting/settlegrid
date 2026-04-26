"""LangChain Python adapter for SettleGrid.

Public API: :func:`metered_tool` — a decorator that wraps a callable or
``langchain_core.tools.BaseTool`` so each invocation triggers SettleGrid
metering. Built as a thin layer over :class:`settlegrid.SettleGrid.wrap`,
mirroring the TS ``@settlegrid/langchain`` package's ``wrapLangchainTool``.
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
