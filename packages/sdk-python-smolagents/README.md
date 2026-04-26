# settlegrid-smolagents

smolagents adapter for [SettleGrid](https://settlegrid.ai) — wrap any
smolagents tool with pay-per-call metering.

## Install

```bash
pip install settlegrid-smolagents
```

The smolagents version is **pinned** (`smolagents~=1.24.0`) because
smolagents' tool API is less stable than the mainstream frameworks.
Bump deliberately when smolagents 1.25 ships and re-test.

## Quickstart

```python
from smolagents import tool
from settlegrid import SettleGrid
from settlegrid_smolagents import metered_tool

sg = SettleGrid(api_key="sg_live_seller_key", tool_slug="my-search")

@tool
def search(query: str) -> str:
    """Search the web.

    Args:
        query: The query to search for.
    """
    return f"results for {query}"

metered_tool(sg, meter="search", price_cents=10, api_key="sg_live_buyer_key")(search)

# Dispatch via Tool.__call__ → self.forward(...). Metering fires.
result = search(query="hello")
```

## Limitations

**Remote-execution path is not metered.** The `@tool` decorator captures
the function's source string as `SimpleTool.__source__` (used by
smolagents' remote/sandbox executors to serialize tools across
processes). Our `forward` patch is applied at the *instance* level, so
it works for any in-process dispatch — including the default local
executor — but a remote executor that re-executes the captured source
runs the *original* function without the metering wrapper. If you ship
to a sandbox/remote executor, meter on the sandbox side or wrap your
tool's underlying API calls directly.

## License

Apache-2.0
