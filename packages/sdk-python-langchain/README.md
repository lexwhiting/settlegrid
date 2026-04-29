# settlegrid-langchain

LangChain Python adapter for [SettleGrid](https://settlegrid.ai) — wrap any
LangChain tool with pay-per-call metering.

## Install

```bash
pip install settlegrid-langchain
```

## Quickstart

Two equivalent forms:

**Explicit (recommended for libraries):**

```python
from langchain_core.tools import tool
from settlegrid import SettleGrid
from settlegrid_langchain import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

@tool
@metered_tool(sg, meter="search", price_cents=10)
def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"
```

**Configured default (matches the spec's bare signature):**

```python
from settlegrid_langchain import configure, metered_tool

configure(SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search"))

@tool
@metered_tool(meter="search", price_cents=10)
def search(query: str) -> str:
    """Search the web."""
    return f"results for {query}"
```

At invoke time, pass the buyer's API key via the standard SettleGrid
kwarg — same shape as `sg.wrap`-decorated functions:

```python
search.invoke({"query": "hello", "_settlegrid_api_key": "sg_live_buyer_key"})
```

## API

`metered_tool(sg=None, *, meter, price_cents, api_key=None)` — decorator
that wraps either a callable or a LangChain `BaseTool`. If `sg` is
omitted, the module-level default client (set via `configure(sg)`) is
used. The wrapped target:

1. Validates the buyer's API key (cached).
2. Runs the original callable.
3. Meters `price_cents` against the buyer's account on success.
4. Skips metering if the callable raised — TS SDK's pay-only-for-success
   semantics.

The decorator preserves `__name__`, `__doc__`, `__module__`, and the
function signature so LangChain's tool introspection still works.

## License

Apache-2.0
