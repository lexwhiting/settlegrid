# settlegrid-crewai

CrewAI adapter for [SettleGrid](https://settlegrid.ai) — wrap CrewAI
tools with pay-per-call metering.

## Install

```bash
pip install settlegrid-crewai
```

## Quickstart

```python
from crewai.tools import tool
from settlegrid import SettleGrid
from settlegrid_crewai import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

@tool("search")
@metered_tool(sg, meter="search", price_cents=10, api_key="sg_live_buyer_key")
def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"

result = search.run(query="hello")
```

## License

Apache-2.0
