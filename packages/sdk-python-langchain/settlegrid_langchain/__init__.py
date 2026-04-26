"""LangChain Python adapter for SettleGrid.

Public API: :func:`metered_tool` — a decorator that wraps a callable or
``langchain_core.tools.BaseTool`` so each invocation triggers SettleGrid
metering. Built as a thin layer over :class:`settlegrid.SettleGrid.wrap`,
mirroring the TS ``@settlegrid/langchain`` package's ``wrapLangchainTool``.
"""

from __future__ import annotations

from .tool import metered_tool

__version__ = "0.1.0"

__all__ = ["__version__", "metered_tool"]
