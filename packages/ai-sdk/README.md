# @settlegrid/ai-sdk

Vercel AI SDK adapter for [SettleGrid](https://settlegrid.ai) — monetize
any `tool({ execute })` with per-invocation billing in one line of
change.

## Install

```bash
npm install @settlegrid/ai-sdk @settlegrid/mcp ai
```

`@settlegrid/mcp` and `ai` are peer dependencies — the adapter is a
thin shim that assumes you already have both in your project.

## Quickstart

```typescript
import { tool } from 'ai'
import { wrapAiTool } from '@settlegrid/ai-sdk'
import { z } from 'zod'

// 1. Wrap your tool's execute function with wrapAiTool.
//    Give it your SettleGrid tool slug + pricing config.
const searchTool = tool({
  description: 'Search the web',
  parameters: z.object({ query: z.string() }),
  execute: wrapAiTool(
    async ({ query }) => {
      const results = await performSearch(query)
      return { results }
    },
    {
      toolSlug: 'my-search',
      pricing: { defaultCostCents: 2 },
    },
  ),
})

// 2. At the call site (API route), pass the consumer's SettleGrid
//    key via `experimental_context.settlegridKey`:

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const { prompt } = await request.json()

  const result = await generateText({
    model: openai('gpt-4o'),
    tools: { searchTool },
    prompt,
    experimental_context: {
      settlegridKey: apiKey ?? undefined,
    },
  })

  return Response.json({ text: result.text })
}
```

That's it. Every call to `searchTool` is now:

- **Validated** against the consumer's SettleGrid API key.
- **Billed** at the configured rate (`defaultCostCents: 2` above).
- **Metered** against the consumer's balance.
- **Recorded** in your SettleGrid dashboard.

## API

### `wrapAiTool(execute, options)`

Wraps a tool's `execute` function with SettleGrid billing.

#### Parameters

- **`execute`** — `(args) => Promise<result> | result`. Your tool's
  business logic. Takes the parsed arguments matching your
  `parameters` schema and returns the tool result. Keep this function
  focused on the tool's work — don't touch Vercel AI SDK's options
  object here.

- **`options`** — `WrapAiToolOptions`:

  | Field | Type | Required | Description |
  |---|---|---|---|
  | `toolSlug` | `string` | yes | Tool slug registered at https://settlegrid.ai/tools |
  | `pricing` | `PricingConfig \| GeneralizedPricingConfig` | yes | Per-invocation cost config (defaultCostCents + per-method overrides) |
  | `method` | `string` | no | Method name for per-method pricing lookup |

#### Returns

A function matching the Vercel AI SDK v5+ `execute` contract:
`(args, { experimental_context }) => Promise<result>`.

#### Errors

- **`InvalidKeyError`** (HTTP status 401) — thrown when
  `experimental_context.settlegridKey` is missing, empty, or not a
  string. The Vercel AI SDK surfaces this as a tool error; you can
  catch and map to a 401 HTTP response in your route handler.

- **`InsufficientCreditsError`** (HTTP status 402) — thrown when the
  consumer's balance is below the required cost. Also surfaced as a
  tool error.

- Other `@settlegrid/mcp` errors propagate through unchanged
  (`BudgetExceededError`, `RateLimitedError`,
  `SettleGridUnavailableError`, etc.). Catch `SettleGridError` to
  handle all of them uniformly.

## Error-handling example

```typescript
import { SettleGridError, InvalidKeyError } from '@settlegrid/mcp'

try {
  const result = await generateText({ /* ... */ })
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

## Per-method pricing

```typescript
execute: wrapAiTool(
  async ({ mode, query }) => { /* ... */ },
  {
    toolSlug: 'my-tool',
    method: 'deep-search', // matches a methods key in pricing
    pricing: {
      defaultCostCents: 1,
      methods: {
        'deep-search': { costCents: 10, displayName: 'Deep Search' },
      },
    },
  },
)
```

## License

MIT — © Alerterra, LLC.
