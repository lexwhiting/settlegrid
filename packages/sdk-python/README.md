# settlegrid

Python SDK for [SettleGrid](https://settlegrid.ai) — pay-per-call billing for AI
tools. 1:1 port of the TypeScript [`@settlegrid/mcp`](../mcp) surface for the
Python AI ecosystem (Pydantic AI, DSPy, LangChain, LlamaIndex, CrewAI).

Status: **alpha** — surface frozen at the same level as TS SDK v0.2.0 (P1.SDK5).
Test parity arrives in P3.PYTHON2; framework adapter packages
(`settlegrid-langchain`, `settlegrid-llamaindex`, `settlegrid-crewai`,
`settlegrid-pydantic-ai`, `settlegrid-dspy`, `settlegrid-smolagents`) ship in
P3.PYTHON3-5.

## Install

```sh
pip install settlegrid
```

Or for local development from the monorepo:

```sh
cd packages/sdk-python
pip install -e ".[dev]"
```

## Usage

### Decorator

```python
from settlegrid import SettleGrid

sg = SettleGrid(api_key="sg_live_...")

@sg.wrap(meter="my-tool", price_cents=10)
def my_tool(query: str) -> str:
    return f"result for {query}"
```

### Async

```python
import asyncio
from settlegrid import SettleGrid

sg = SettleGrid(api_key="sg_live_...")

@sg.wrap(meter="my-tool", price_cents=10)
async def my_tool(query: str) -> str:
    return f"result for {query}"

asyncio.run(my_tool("hello"))
```

### Context manager (sync + async)

```python
with sg.wrap(meter="my-tool", price_cents=10) as inv:
    inv.record(...)
    # work happens here

async with sg.wrap(meter="my-tool", price_cents=10) as inv:
    ...
```

### Manual

```python
result = sg.validate_key("sg_live_buyer_...")
print(result.consumer_id, result.balance_cents)

meter_result = await sg.meter_async("sg_live_buyer_...", method="search")
print(meter_result.cost_cents, meter_result.remaining_balance_cents)
```

## Errors

All errors extend `SettleGridError`. Catch the base for any SDK error or use
specific subclasses for fine-grained handling:

```python
from settlegrid import (
    SettleGridError,
    InvalidKeyError,
    InsufficientCreditsError,
    BudgetExceededError,
    ToolNotFoundError,
    ToolDisabledError,
    RateLimitedError,
    SettleGridUnavailableError,
    NetworkError,
    TimeoutError,
)
```

## License

Apache-2.0
