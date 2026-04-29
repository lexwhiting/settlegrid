# settlegrid-llamaindex

LlamaIndex adapter for [SettleGrid](https://settlegrid.ai) — wrap any
LlamaIndex tool with pay-per-call metering.

## Install

```bash
pip install settlegrid-llamaindex
```

## Quickstart

```python
from llama_index.core.tools import FunctionTool
from settlegrid import SettleGrid
from settlegrid_llamaindex import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

# Wrap a callable, then register it with LlamaIndex normally.
@metered_tool(sg, meter="search", price_cents=10, api_key="sg_live_buyer_key")
def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"

tool = FunctionTool.from_defaults(fn=search, name="search")
result = tool.call(query="hello")
```

## License

Apache-2.0
