# @settlegrid/mastra

[Mastra](https://mastra.ai) adapter for [SettleGrid](https://settlegrid.ai) —
monetize any `createTool({ execute })` with per-invocation billing in
one line of change.

## Install

```bash
npm install @settlegrid/mastra @settlegrid/mcp @mastra/core
```

`@settlegrid/mcp` and `@mastra/core` are peer dependencies.

## Quickstart

```typescript
import { createTool } from '@mastra/core'
import { wrapMastraTool } from '@settlegrid/mastra'
import { z } from 'zod'

// 1. Wrap your tool's execute function.
//    Your execute takes `input` directly — the wrapper extracts it
//    from Mastra's `{ context, runtimeContext, mastra }` param for
//    you, so you don't need to destructure `context` yourself.
const searchTool = createTool({
  id: 'search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  execute: wrapMastraTool(
    async (input) => {
      const results = await performSearch(input.query)
      return { results }
    },
    {
      toolSlug: 'my-search',
      pricing: { defaultCostCents: 2 },
    },
  ),
})

// 2. At the call site, set the consumer's SettleGrid key on the
//    RuntimeContext before invoking the agent:

import { RuntimeContext } from '@mastra/core'

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const { prompt } = await request.json()

  const runtimeContext = new RuntimeContext()
  if (apiKey) runtimeContext.set('settlegridKey', apiKey)

  const result = await myAgent.generate(prompt, {
    runtimeContext,
    tools: { searchTool },
  })

  return Response.json({ text: result.text })
}
```

Every call to `searchTool` is now:

- **Validated** against the consumer's SettleGrid API key.
- **Billed** at the configured rate (`defaultCostCents: 2` above).
- **Metered** against the consumer's balance.
- **Recorded** in your SettleGrid dashboard.

## API

### `wrapMastraTool(execute, options)`

Wraps a tool's `execute` function with SettleGrid billing.

#### Parameters

- **`execute`** — `(input) => Promise<result> | result`. Your tool's
  business logic. Takes the parsed input matching your
  `inputSchema` and returns the tool result.

- **`options`** — `WrapMastraToolOptions`:

  | Field | Type | Required | Description |
  |---|---|---|---|
  | `toolSlug` | `string` | yes | Tool slug registered at https://settlegrid.ai/tools |
  | `pricing` | `PricingConfig \| GeneralizedPricingConfig` | yes | Per-invocation cost config |
  | `method` | `string` | no | Method name for per-method pricing lookup |

#### Returns

A function matching Mastra's `createTool` execute contract:
`({ context, runtimeContext, mastra? }) => Promise<result>` (one
destructured object argument).

Your execute function remains `(input) => result` — the adapter
handles the unwrap from Mastra's `{ context }` field.

#### runtimeContext extraction

The adapter supports **two shapes** for the `runtimeContext`:

1. **`RuntimeContext` class** (canonical Mastra shape):
   ```typescript
   const runtimeContext = new RuntimeContext()
   runtimeContext.set('settlegridKey', 'sg_live_...')
   ```
   The adapter calls `.get('settlegridKey')`.

2. **Plain object** (for consumers who prefer literals):
   ```typescript
   const runtimeContext = { settlegridKey: 'sg_live_...' }
   ```
   The adapter reads `.settlegridKey` directly.

#### Errors

- **`InvalidKeyError`** (HTTP status 401) — thrown when the key is
  missing, empty, non-string, or contains control characters /
  non-ASCII bytes (header-injection defense). Mastra surfaces this
  as a tool error.

- **`InsufficientCreditsError`** (HTTP status 402) — thrown when the
  consumer's balance is below the required cost.

- Other `@settlegrid/mcp` errors (`BudgetExceededError`,
  `RateLimitedError`, etc.) propagate through unchanged.

## Error-handling example

```typescript
import { SettleGridError, InvalidKeyError } from '@settlegrid/mcp'

try {
  const result = await myAgent.generate(prompt, { runtimeContext, tools })
} catch (err) {
  if (err instanceof InvalidKeyError) {
    return new Response('Missing API key', { status: 401 })
  }
  if (err instanceof SettleGridError) {
    return new Response(err.message, { status: err.statusCode })
  }
  throw err
}
```

## License

MIT — © Alerterra, LLC.
