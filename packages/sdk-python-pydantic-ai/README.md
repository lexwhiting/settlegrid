# settlegrid-pydantic-ai

Pydantic AI adapter for [SettleGrid](https://settlegrid.ai) — wrap
Pydantic AI tools with pay-per-call metering.

## Install

```bash
pip install settlegrid-pydantic-ai
```

## Quickstart

```python
from pydantic_ai import Agent
from pydantic_ai.tools import Tool
from settlegrid import SettleGrid
from settlegrid_pydantic_ai import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

@metered_tool(sg, meter="search", price_cents=10, api_key="sg_live_buyer_key")
def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"

# Register with the agent normally:
agent = Agent("openai:gpt-4o", tools=[Tool(search)])
```

## License

Apache-2.0
