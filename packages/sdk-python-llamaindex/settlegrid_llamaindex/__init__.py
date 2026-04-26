"""LlamaIndex adapter for SettleGrid.

Public API: :func:`metered_tool` — decorator that wraps a callable or
``llama_index.core.tools.FunctionTool`` with SettleGrid pay-per-call
metering. Built as a thin layer over :class:`settlegrid.SettleGrid.wrap`,
mirroring the ``settlegrid_langchain`` pattern but adapted to LlamaIndex's
``fn``/``async_fn`` slot model and ``ToolMetadata`` introspection.
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
