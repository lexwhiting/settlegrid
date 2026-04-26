# settlegrid-dspy

DSPy adapter for [SettleGrid](https://settlegrid.ai) — wrap any DSPy
tool with pay-per-call metering.

## Install

```bash
pip install settlegrid-dspy
```

The DSPy version is **pinned** (`dspy-ai~=3.2.0`) because DSPy's tool
API is less stable than the mainstream frameworks. Bump deliberately
when DSPy 3.3 ships and re-test.

## Quickstart

```python
import dspy
from settlegrid import SettleGrid
from settlegrid_dspy import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"

# Build a DSPy Tool, then wrap it.
tool = dspy.Tool(func=search, name="search")
metered_tool(sg, meter="search", price_cents=10, api_key="sg_live_buyer_key")(tool)

# Both sync and async dispatch surfaces meter:
result = tool(query="hello")          # via Tool.__call__
# result = await tool.acall(query="hello")  # via Tool.acall
```

## License

Apache-2.0
